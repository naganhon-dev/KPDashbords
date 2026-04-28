/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { User, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import * as XLSX from 'xlsx';
import toast, { Toaster } from "react-hot-toast";
import Dashboard from './components/Dashboard';
import DeadlineEditor from './components/DeadlineEditor';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'editor'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'forest' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('app-theme') as 'forest' | 'light' | 'dark') || 'forest';
  });
  const [uploadingStudents, setUploadingStudents] = useState(false);
  const studentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleStudentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingStudents(true);
    const toastId = toast.loading('Обработка файла...');
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(worksheet) as any[];

      const processed = rawJson.map(row => {
        const email = row['Email'] || row['email'] || row['Почта'] || '';
        const stream = row['Поток'] !== undefined ? String(row['Поток']) : '';
        const block = row['Блок'] !== undefined ? String(row['Блок']) : '';
        return {
          id: String(email).trim().toLowerCase(),
          email: String(email).trim().toLowerCase(),
          stream,
          block
        };
      }).filter(s => s.email && s.stream && s.block);

      if (processed.length === 0) {
        toast.error("Не найдено корректных данных студентов.", { id: toastId });
        return;
      }

      let batch = writeBatch(db);
      let count = 0;
      for (const student of processed) {
        const ref = doc(db, 'students', student.id);
        batch.set(ref, {
          email: student.email,
          stream: student.stream,
          block: student.block,
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        count++;
        if (count === 490) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }

      toast.success(`Загружено ${processed.length} студентов`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Ошибка при обработке файла', { id: toastId });
    } finally {
      setUploadingStudents(false);
      if (studentInputRef.current) studentInputRef.current.value = '';
    }
  };

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
  }, [theme]);

  if (loading) {
    return <div className={`h-full flex items-center justify-center font-sans ${theme === 'light' ? 'bg-[#f8f9fa] text-slate-900' : 'bg-zinc-950 text-white'}`}>Загрузка...</div>;
  }

  if (!user) {
    return (
      <div className={`h-full flex items-center justify-center font-sans p-4 theme-${theme} bg-[var(--app-bg)]`}>
        <Toaster position="top-right" toastOptions={{ style: { background: 'var(--app-sidebar)', color: 'var(--app-text)', border: '1px solid var(--app-border)' } }} />
        <div className="glass-panel w-full max-w-sm rounded-2xl p-8 accent-glow" style={{ borderColor: 'var(--app-accent)' }}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: 'var(--app-text)' }}>Вход в систему</h1>
            <p style={{ color: 'var(--app-text-muted)' }}>Войдите для доступа к дашборду</p>
          </div>
          <button 
            className="w-full text-white font-medium py-3 rounded-xl transition-all"
            style={{ backgroundColor: 'var(--app-accent)' }}
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

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'dark') return 'forest';
      if (prev === 'forest') return 'light';
      return 'dark';
    });
  };

  return (
    <div className={`h-full flex font-sans overflow-hidden theme-${theme} bg-[var(--app-bg)]`} style={{ color: 'var(--app-text)' }}>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--app-sidebar)', color: 'var(--app-text)', border: '1px solid var(--app-border)' } }} />
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 border-r flex flex-col justify-between p-6 h-full flex-shrink-0 transition-transform duration-300 lg:relative lg:translate-x-0 shadow-[8px_0px_20px_-10px_rgba(0,0,0,0.2)] ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ backgroundColor: 'var(--app-sidebar)', borderColor: 'var(--app-border)' }}>
        <div className="space-y-8">
          <div className="flex items-center justify-between lg:block">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8" fill="var(--app-accent)">
                  <path d="M22 10.5c0-.828-.672-1.5-1.5-1.5h-1.5V7c0-2.209-1.791-4-4-4H9C6.791 3 5 4.791 5 7v2H3.5C2.672 9 2 9.672 2 10.5v3c0 .828.672 1.5 1.5 1.5H5v2c0 2.209 1.791 4 4 4h6c2.209 0 4-1.791 4-4v-2h1.5c.828 0 1.5-.672 1.5-1.5v-3z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--app-text)' }}>Дашборд КП</h1>
            </div>
            <button className="lg:hidden p-2" onClick={() => setIsMobileMenuOpen(false)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          
          <nav className="space-y-4">
            <button 
              onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 font-medium p-2 rounded-lg transition-colors ${activeTab === 'dashboard' ? '' : 'text-zinc-500 hover:text-zinc-300'}`}
              style={activeTab === 'dashboard' ? { backgroundColor: 'var(--app-card)', color: 'var(--app-text)', border: '1px solid var(--app-border)' } : { color: 'var(--app-text-muted)' }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
              Главная
            </button>
          </nav>
        </div>
        
        <div className="flex flex-col gap-4">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            ref={studentInputRef} 
            onChange={handleStudentUpload} 
            disabled={uploadingStudents} 
            className="hidden" 
          />
          <button
            onClick={() => studentInputRef.current?.click()}
            disabled={uploadingStudents}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-semibold border transition-all hover:bg-black/5 disabled:opacity-50"
            style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            {uploadingStudents ? 'Загрузка...' : 'Загрузить студентов'}
          </button>

          <div className="p-4 rounded-xl border cursor-pointer group shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-y-0.5 active:shadow-none transition-all" style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)' }} onClick={() => auth.signOut()}>
            <p className="text-xs font-semibold group-hover:opacity-80 transition-opacity" style={{ color: 'var(--app-accent)' }}>Выйти</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden" style={{ backgroundColor: 'var(--app-bg)' }}>
        <header className="h-20 border-b flex items-center justify-between lg:justify-end px-4 lg:px-8 flex-shrink-0" style={{ backgroundColor: 'var(--app-sidebar)', borderColor: 'var(--app-border)' }}>
          <button 
            className="lg:hidden p-2 rounded-lg border"
            style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
          </button>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full border transition-all hover:bg-black/5"
              style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}
              title="Переключить тему"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
              ) : theme === 'forest' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
              )}
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{user.email}</p>
            </div>
            <div className="w-10 h-10 rounded-full border flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'var(--app-card)', borderColor: 'var(--app-border)' }}>
              {user.photoURL ? <img src={user.photoURL} alt="avatar" /> : <div style={{ color: 'var(--app-text-muted)' }}>A</div>}
            </div>
          </div>
        </header>
        
        <div className="flex-1 p-4 lg:p-10 overflow-auto">
          {activeTab === 'dashboard' ? <Dashboard /> : <DeadlineEditor />}
        </div>
      </main>
    </div>
  );
}

