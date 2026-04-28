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
  const [uploadingStudents, setUploadingStudents] = useState(false);
  const [uploadingDeadlines, setUploadingDeadlines] = useState(false);
  
  const studentInputRef = useRef<HTMLInputElement>(null);
  const deadlineInputRef = useRef<HTMLInputElement>(null);

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

  const handleStudentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingStudents(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(worksheet) as any[];

      const processed: Student[] = rawJson.map(row => {
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
        toast.error("Не найдено корректных данных студентов.");
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

      toast.success(`Успешно загружено ${processed.length} студентов`);
    } catch (error) {
      console.error(error);
      toast.error('Ошибка при обработке файла студентов');
    } finally {
      setUploadingStudents(false);
      if (studentInputRef.current) studentInputRef.current.value = '';
    }
  };

  const handleDeadlineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDeadlines(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(worksheet) as any[];

      const processed: Deadline[] = rawJson.map(row => {
        const stream = row['Поток'] !== undefined ? String(row['Поток']).trim() : '';
        const format = row['Формат'] !== undefined ? String(row['Формат']).trim() : '';
        const block = row['Блок'] !== undefined ? String(row['Блок']).trim() : '';
        const startDate = row['Дата старта'] !== undefined ? String(row['Дата старта']).trim() : '';
        const endDate = row['Дата окончания'] !== undefined ? String(row['Дата окончания']).trim() : '';
        
        const id = `${stream}-${format}-${block}`.toLowerCase().replace(/\s+/g, '-');
        return {
          id, stream, format, block, startDate, endDate
        };
      }).filter(d => d.stream && d.format && d.block && d.startDate && d.endDate && !(d.block === 'Блок 13' && d.format === 'Базовый'));

      if (processed.length === 0) {
        toast.error("Не найдено корректных данных дедлайнов.");
        return;
      }

      let batch = writeBatch(db);
      let count = 0;
      for (const d of processed) {
        const ref = doc(db, 'deadlines', d.id);
        batch.set(ref, {
          stream: d.stream,
          format: d.format,
          block: d.block,
          startDate: d.startDate,
          endDate: d.endDate,
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

      toast.success(`Успешно загружено ${processed.length} дедлайнов`);
    } catch (error) {
      console.error(error);
      toast.error('Ошибка при обработке файла дедлайнов');
    } finally {
      setUploadingDeadlines(false);
      if (deadlineInputRef.current) deadlineInputRef.current.value = '';
    }
  };

  const searchedStudent = search.trim() !== '' ? students.find(s => s.email.includes(search.toLowerCase().trim())) : null;

  const parseDate = (d: string) => {
    if (!d) return null;
    const parts = d.split('.');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day);
  };

  const getCurrentStreamBlock = (stream: string) => {
    if (!deadlines.length) return null;
    const now = new Date();
    // Default to 'Базовый' format if available, otherwise just grab any from the stream
    const streamDeadlines = deadlines.filter(d => d.stream === stream);
    
    const activeBlocks = streamDeadlines.filter(d => {
      const start = parseDate(d.startDate);
      const end = parseDate(d.endDate);
      if (!start) return false;
      
      const isStarted = now >= start;
      const isNotEnded = !end || now <= end;
      
      return isStarted && isNotEnded;
    });

    if (activeBlocks.length === 0) return 'Не начат';

    // Sort by start date descending to get the "latest" active block
    activeBlocks.sort((a, b) => {
      const dateA = parseDate(a.startDate)?.getTime() || 0;
      const dateB = parseDate(b.startDate)?.getTime() || 0;
      return dateB - dateA;
    });

    return activeBlocks[0].block;
  };

  const currentStreamBlock = searchedStudent ? getCurrentStreamBlock(searchedStudent.stream) : null;

  const streams = Array.from(new Set<string>(deadlines.map(d => d.stream as string))).sort((a: string, b: string) => parseInt(a) - parseInt(b));
  
  const formatOrder = ['Базовый', 'Расширенный', 'VIP'];
  const formats = Array.from(new Set<string>(deadlines.filter(d => !selectedStream || d.stream === selectedStream).map(d => d.format as string)))
    .sort((a: string, b: string) => {
      const idxA = formatOrder.indexOf(a);
      const idxB = formatOrder.indexOf(b);
      return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });

  const extractBlockNum = (b: string) => {
    const match = b.match(/\d+/);
    return match ? parseInt(match[0], 10) : 999;
  };

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
    <div className="w-full h-full flex flex-col text-white pb-10">
      
      {/* Top Search Area */}
      <div className="relative w-full max-w-2xl mx-auto mb-10 shrink-0">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-zinc-500">
           <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </span>
        <input 
          type="text" 
          className="block w-full bg-zinc-900/80 border border-zinc-700 rounded-xl pl-12 pr-4 py-3 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xl transition-all" 
          placeholder="Быстрый поиск студента по почте (test1@gmail.com)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {search.trim() !== '' && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between accent-glow border-blue-500/30 mb-8 gap-4 max-w-5xl mx-auto w-full shrink-0">
          {searchedStudent ? (
            <div className="flex flex-col md:flex-row items-center gap-6 w-full">
              <div>
                <p className="text-xs text-blue-400 uppercase tracking-widest font-bold mb-1">Результат поиска</p>
                <h2 className="text-xl md:text-2xl text-white font-bold">{searchedStudent.email}</h2>
              </div>
              <div className="hidden md:block h-12 w-px bg-zinc-800"></div>
              <div className="flex gap-8">
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-500 uppercase">Поток</span>
                  <span className="text-lg text-white font-semibold">{searchedStudent.stream}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-500 uppercase">Блок (в карточке)</span>
                  <span className="text-lg text-white font-semibold">{searchedStudent.block}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-blue-400 uppercase font-bold">Блок (по сроку)</span>
                  <span className="text-lg text-blue-300 font-bold">{currentStreamBlock ? getBlockLabel(currentStreamBlock) : '—'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-zinc-400">Пользователь с такой почтой не найден</div>
          )}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-5xl mx-auto flex-1 h-full min-h-0">
        
        {/* Deadlines Block (Replacing Catalog) */}
        <div className="lg:col-span-8 glass-panel rounded-2xl p-6 flex flex-col h-full overflow-hidden border-zinc-800/50">
          <div className="flex items-center gap-2 mb-6">
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <h3 className="text-lg text-white font-semibold tracking-tight">Поиск дедлайна</h3>
          </div>
          
          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Поток</label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none appearance-none"
                  value={selectedStream} 
                  onChange={(e) => { setSelectedStream(e.target.value); setSelectedFormat(''); setSelectedBlock(''); }}
                >
                  <option value="">Выберите поток</option>
                  {streams.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Формат</label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none appearance-none"
                  value={selectedFormat} 
                  onChange={(e) => { setSelectedFormat(e.target.value); setSelectedBlock(''); }}
                  disabled={!selectedStream}
                >
                  <option value="">Выберите формат</option>
                  {formats.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Блок</label>
                <select 
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none appearance-none"
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
            <div className="mt-auto p-5 bg-zinc-950/80 rounded-xl border border-zinc-800 flex flex-col gap-4">
              <div className="text-center">
                <span className="text-lg font-bold text-zinc-400">Не сдает</span>
              </div>
            </div>
          ) : currentResult ? (
            <div className="mt-auto p-5 bg-zinc-950/80 rounded-xl border border-zinc-800 flex flex-col gap-4 accent-glow border-blue-500/20">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500 tracking-wider font-medium">СТАРТ</span>
                <span className="text-md font-mono text-emerald-400">{currentResult.startDate || 'Не указано'}</span>
              </div>
              <div className="w-full h-px bg-zinc-800"></div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500 tracking-wider font-medium">КОНЕЦ</span>
                <span className="text-md font-mono text-rose-400">{currentResult.endDate || 'Не указано'}</span>
              </div>
            </div>
          ) : (
            selectedStream && selectedFormat && selectedBlock && (
              <div className="mt-auto text-center text-sm text-zinc-500 py-4">Данные не найдены</div>
            )
          )}
        </div>

        {/* Uploads Block */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 flex flex-col flex-1">
            <h3 className="text-base text-white font-medium mb-1">Студенты</h3>
            <p className="text-xs text-zinc-500 mb-4">xlsx, csv с колонками: Email, Поток, Блок</p>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-zinc-700 border-dashed rounded-xl cursor-pointer bg-zinc-900/50 hover:bg-zinc-800/50 transition-all">
              <div className="flex flex-col items-center justify-center pt-2 pb-2">
                  <svg className="w-6 h-6 mb-2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>
                  <p className="text-xs text-zinc-400 font-semibold">Загрузить</p>
              </div>
              <input type="file" accept=".xlsx, .xls, .csv" ref={studentInputRef} onChange={handleStudentUpload} disabled={uploadingStudents} className="hidden" />
            </label>
            {uploadingStudents && <p className="text-xs text-blue-400 mt-2 text-center">Загрузка...</p>}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 flex flex-col flex-1">
            <h3 className="text-base text-white font-medium mb-1">Дедлайны</h3>
            <p className="text-xs text-zinc-500 mb-4">xlsx, csv с колонками: Поток, Формат, Блок, Дата старта, Дата окончания</p>
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-zinc-700 border-dashed rounded-xl cursor-pointer bg-zinc-900/50 hover:bg-zinc-800/50 transition-all">
              <div className="flex flex-col items-center justify-center pt-2 pb-2">
                  <svg className="w-6 h-6 mb-2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path></svg>
                  <p className="text-xs text-zinc-400 font-semibold">Загрузить</p>
              </div>
              <input type="file" accept=".xlsx, .xls, .csv" ref={deadlineInputRef} onChange={handleDeadlineUpload} disabled={uploadingDeadlines} className="hidden" />
            </label>
            {uploadingDeadlines && <p className="text-xs text-blue-400 mt-2 text-center">Загрузка...</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
