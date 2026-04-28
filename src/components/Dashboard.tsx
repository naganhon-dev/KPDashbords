import React, { useState, useRef, useEffect } from 'react';
import { collection, doc, writeBatch, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface Student {
  id: string;
  email: string;
  stream: string;
  block: string;
  updatedAt?: any;
}

interface Deadline {
  id: string; // "stream-format-block"
  stream: string;
  format: string;
  block: string;
  startDate: string;
  endDate: string;
  updatedAt?: any;
}

export default function Dashboard() {
  const [students, setStudents] = useState<Student[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  
  const [search, setSearch] = useState('');

  const [selectedStream, setSelectedStream] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [selectedBlock, setSelectedBlock] = useState<string>('');

  useEffect(() => {
    const qStudents = query(collection(db, 'students'));
    const unsubscribeStudents = onSnapshot(qStudents, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'students'));

    const qDeadlines = query(collection(db, 'deadlines'));
    const unsubscribeDeadlines = onSnapshot(qDeadlines, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deadline));
      setDeadlines(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'deadlines'));

    return () => {
      unsubscribeStudents();
      unsubscribeDeadlines();
    };
  }, []);

  const searchedStudent = search.trim() !== '' ? students.find(s => s.email.includes(search.toLowerCase().trim())) : null;

  const parseDate = (d: string) => {
    if (!d) return null;
    const parts = d.split('.');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  };

  const extractBlockNum = (b: string) => {
    const match = b.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const getCurrentStreamBlock = (stream: string) => {
    if (!deadlines.length) return null;
    const now = new Date();
    
    const startedDeadlines = deadlines.filter(d => {
      if (d.stream !== stream) return false;
      const start = parseDate(d.startDate);
      return start && now >= start;
    });

    if (startedDeadlines.length === 0) return 'Не начат';

    let maxBlockNum = -1;
    let maxBlockId = '';

    startedDeadlines.forEach(d => {
      const num = extractBlockNum(d.block);
      if (num > maxBlockNum) {
        maxBlockNum = num;
        maxBlockId = d.block;
      }
    });

    return maxBlockId;
  };

  const currentStreamBlock = searchedStudent ? getCurrentStreamBlock(searchedStudent.stream) : null;

  const streamStartDates = React.useMemo(() => {
    const map: Record<string, string> = {};
    deadlines.forEach(d => {
      // Find the start date for the first block of each stream
      if (d.block && (d.block === 'Блок 1' || d.block === 'Блок 1 ')) {
        // We only set it if not already set or prioritize something? 
        // Usually they are the same for all formats in Блок 1
        map[d.stream] = d.startDate;
      }
    });
    return map;
  }, [deadlines]);

  const formatStreamDisplay = (stream: string) => {
    const startDate = streamStartDates[stream];
    return startDate ? `${stream} (${startDate})` : stream;
  };

  const streams = Array.from(new Set<string>(deadlines.map(d => d.stream as string))).sort((a: string, b: string) => parseInt(a) - parseInt(b));
  
  const formatOrder = ['Базовый', 'Расширенный', 'VIP'];
  const formats = Array.from(new Set<string>(deadlines.filter(d => !selectedStream || d.stream === selectedStream).map(d => d.format as string)))
    .sort((a: string, b: string) => {
      const idxA = formatOrder.indexOf(a);
      const idxB = formatOrder.indexOf(b);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

  const blocks = Array.from(new Set<string>(deadlines.filter(d => 
    (!selectedStream || d.stream === selectedStream) && 
    (!selectedFormat || d.format === selectedFormat)
  ).map(d => d.block as string))).sort((a: string, b: string) => extractBlockNum(a) - extractBlockNum(b));

  const getBlockLabel = (blockId: string) => {
    if (blockId === 'Блок 13') return 'Алгоритм';
    if (blockId === 'Блок 14') return 'Финальный тест';
    return blockId;
  };

  const currentResult = deadlines.find(d => 
    d.stream === selectedStream && d.format === selectedFormat && d.block === selectedBlock
  );

  return (
    <div className="w-full h-full flex flex-col pb-10" style={{ color: 'var(--app-text)' }}>
      
      {/* Top Search Area */}
      <div className="relative w-full max-w-2xl mx-auto mb-10 shrink-0">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center" style={{ color: 'var(--app-text-muted)' }}>
           <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </span>
        <input 
          type="text" 
          className="block w-full rounded-xl pl-12 pr-4 py-3 shadow-xl transition-all border outline-none focus:ring-1 focus:ring-[var(--app-accent)] focus:border-[var(--app-accent)]" 
          style={{ 
            backgroundColor: 'var(--app-card)', 
            borderColor: 'var(--app-border)', 
            color: 'var(--app-text)' 
          }}
          placeholder="Поиск прогресса студента..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {search.trim() !== '' && (
        <div className="glass-panel rounded-2xl p-4 lg:p-6 flex flex-col lg:flex-row items-center justify-between shadow-xl mb-8 gap-4 max-w-5xl mx-auto w-full shrink-0" style={{ borderColor: 'var(--app-accent)' }}>
          {searchedStudent ? (
            <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6 w-full">
              <div className="text-center lg:text-left">
                <p className="text-[10px] lg:text-xs uppercase tracking-widest font-bold mb-1" style={{ color: 'var(--app-accent)' }}>Результат поиска</p>
                <h2 className="text-lg lg:text-2xl font-bold break-all" style={{ color: 'var(--app-text)' }}>{searchedStudent.email}</h2>
              </div>
              <div className="hidden lg:block h-12 w-px" style={{ backgroundColor: 'var(--app-border)' }}></div>
              <div className="grid grid-cols-2 lg:flex gap-4 lg:gap-8 w-full lg:w-auto">
                <div className="flex flex-col">
                  <span className="text-[10px] lg:text-xs uppercase" style={{ color: 'var(--app-text-muted)' }}>Поток</span>
                  <div className="flex flex-col">
                    <span className="text-sm lg:text-lg font-semibold leading-tight" style={{ color: 'var(--app-text)' }}>{searchedStudent.stream}</span>
                    {streamStartDates[searchedStudent.stream] && (
                      <span className="text-[9px] lg:text-[10px] font-medium" style={{ color: 'var(--app-text-muted)' }}>от {streamStartDates[searchedStudent.stream]}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] lg:text-xs uppercase" style={{ color: 'var(--app-text-muted)' }}>Текущий прогресс</span>
                  <span className="text-sm lg:text-lg font-semibold" style={{ color: 'var(--app-text)' }}>{searchedStudent.block}</span>
                </div>
                <div className="flex flex-col col-span-2 lg:col-auto lg:items-start text-center lg:text-left">
                  <span className="text-[10px] lg:text-xs uppercase font-bold" style={{ color: 'var(--app-accent)' }}>Прогресс потока</span>
                  <span className="text-md lg:text-lg font-bold" style={{ color: 'var(--app-accent)' }}>{currentStreamBlock ? getBlockLabel(currentStreamBlock) : '—'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--app-text-muted)' }}>Пользователь с такой почтой не найден</div>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto flex-1 h-full min-h-0">
        
        {/* Deadlines Block (Replacing Catalog) */}
        <div className="w-full glass-panel rounded-2xl p-6 flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-5 h-5" style={{ color: 'var(--app-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <h3 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--app-text)' }}>Сроки открытия/закрытия блоков</h3>
          </div>
          
          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--app-text-muted)' }}>Поток</label>
                <select 
                  className="w-full border rounded-lg p-3 text-sm focus:outline-none appearance-none cursor-pointer focus:ring-1 focus:ring-[var(--app-accent)] focus:border-[var(--app-accent)]"
                  style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  value={selectedStream} 
                  onChange={(e) => { setSelectedStream(e.target.value); setSelectedFormat(''); setSelectedBlock(''); }}
                >
                  <option value="">Выберите поток</option>
                  {streams.map(s => <option key={s} value={s}>{formatStreamDisplay(s)}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--app-text-muted)' }}>Формат</label>
                <select 
                  className="w-full border rounded-lg p-3 text-sm focus:outline-none appearance-none cursor-pointer focus:ring-1 focus:ring-[var(--app-accent)] focus:border-[var(--app-accent)]"
                  style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  value={selectedFormat} 
                  onChange={(e) => { setSelectedFormat(e.target.value); setSelectedBlock(''); }}
                  disabled={!selectedStream}
                >
                  <option value="">Выберите формат</option>
                  {formats.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider font-medium" style={{ color: 'var(--app-text-muted)' }}>Блок</label>
                <select 
                  className="w-full border rounded-lg p-3 text-sm focus:outline-none appearance-none cursor-pointer focus:ring-1 focus:ring-[var(--app-accent)] focus:border-[var(--app-accent)]"
                  style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                  value={selectedBlock} 
                  onChange={(e) => setSelectedBlock(e.target.value)}
                  disabled={!selectedFormat}
                >
                  <option value="">Выберите блок</option>
                  {blocks.map(b => <option key={b} value={b}>{getBlockLabel(b)}</option>)}
                </select>
              </div>
            </div>
          </div>

          {selectedBlock === 'Блок 13' && selectedFormat === 'Базовый' ? (
            <div className="mt-auto p-5 rounded-xl border flex flex-col gap-4" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
              <div className="text-center">
                <span className="text-lg font-bold" style={{ color: 'var(--app-text-muted)' }}>Не сдает</span>
              </div>
            </div>
          ) : currentResult ? (
            <div className="mt-auto p-5 rounded-xl border flex flex-col gap-4 shadow-lg" style={{ backgroundColor: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
              <div className="flex justify-between items-center">
                <span className="text-xs tracking-wider font-medium" style={{ color: 'var(--app-text-muted)' }}>СТАРТ</span>
                <span className="text-md font-mono text-emerald-500 font-bold">{currentResult.startDate || 'Не указано'}</span>
              </div>
              <div className="w-full h-px" style={{ backgroundColor: 'var(--app-border)' }}></div>
              <div className="flex justify-between items-center">
                <span className="text-xs tracking-wider font-medium" style={{ color: 'var(--app-text-muted)' }}>КОНЕЦ</span>
                <span className="text-md font-mono text-rose-500 font-bold">{currentResult.endDate || 'Не указано'}</span>
              </div>
            </div>
          ) : (
            selectedStream && selectedFormat && selectedBlock && (
              <div className="mt-auto text-center text-sm py-4" style={{ color: 'var(--app-text-muted)' }}>Данные не найдены</div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
