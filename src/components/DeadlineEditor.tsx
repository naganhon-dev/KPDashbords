import React, { useState, useEffect } from 'react';
import { collection, doc, writeBatch, query, getDocs, serverTimestamp, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import toast from 'react-hot-toast';

const STREAMS = Array.from({length: 19}, (_, i) => String(42 + i)); // 42 to 60
const FORMATS = ['Расширенный', 'VIP', 'Базовый'];

const BLOCKS = [
  { id: 'Блок 0', title: 'Вводный' },
  { id: 'Блок 1', title: 'Базовые понятия и определения' },
  { id: 'Блок 2', title: 'Уровни' },
  { id: 'Блок 3', title: 'ATR и тренды' },
  { id: 'Блок 4', title: '' },
  { id: 'Блок 5', title: '' },
  { id: 'Блок 6', title: '' },
  { id: 'Блок 7', title: '' },
  { id: 'Блок 8', title: '' },
  { id: 'Блок 9', title: '' },
  { id: 'Блок 10', title: '' },
  { id: 'Блок 11', title: '' },
  { id: 'Блок 12', title: '' },
  { id: 'Блок 13', title: 'Алгоритм' },
  { id: 'Блок 14', title: 'Финальный тест' },
];

export default function DeadlineEditor() {
  const [selectedStream, setSelectedStream] = useState('42');
  const [formData, setFormData] = useState<Record<string, {startDate: string, endDate: string}>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchStreamData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'deadlines'), where('stream', '==', selectedStream));
        const snapshot = await getDocs(q);
        const newData: Record<string, {startDate: string, endDate: string}> = {};
        
        snapshot.docs.forEach(docSnap => {
          const data = docSnap.data();
          const key = `${data.block}-${data.format}`;
          
          let sd = data.startDate || '';
          let ed = data.endDate || '';
          
          // convert DD.MM.YYYY to YYYY-MM-DD to pre-fill the native <input type="date">
          const datePattern = /^(\d{2})\.(\d{2})\.(\d{4})$/;
          if (datePattern.test(sd)) {
            sd = sd.replace(datePattern, '$3-$2-$1');
          }
          if (datePattern.test(ed)) {
            ed = ed.replace(datePattern, '$3-$2-$1');
          }
          
          newData[key] = { startDate: sd, endDate: ed };
        });
        setFormData(newData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'deadlines');
      } finally {
        setLoading(false);
      }
    };
    fetchStreamData();
  }, [selectedStream]);

  const handleChange = (blockId: string, format: string, field: 'startDate' | 'endDate', value: string) => {
    const key = `${blockId}-${format}`;
    setFormData(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { startDate: '', endDate: '' }),
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let batch = writeBatch(db);
      let count = 0;

      for (const block of BLOCKS) {
        for (const format of FORMATS) {
          const key = `${block.id}-${format}`;
          const data = formData[key];
          if (data && (data.startDate || data.endDate)) {
            const id = `${selectedStream}-${format}-${block.id}`.toLowerCase().replace(/\s+/g, '-');
            const ref = doc(db, 'deadlines', id);
            
            // convert YYYY-MM-DD back to DD.MM.YYYY for display matching expectations
            let sd = data.startDate;
            let ed = data.endDate;
            
            const toDDMMYYYY = (d: string) => {
              if (d && d.includes('-') && d.split('-').length === 3) {
                 const p = d.split('-');
                 return `${p[2]}.${p[1]}.${p[0]}`;
              }
              return d;
            }

            batch.set(ref, {
              stream: selectedStream,
              format: format,
              block: block.id,
              startDate: toDDMMYYYY(sd),
              endDate: toDDMMYYYY(ed),
              updatedAt: serverTimestamp()
            }, { merge: true });

            count++;
            if (count === 490) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
        }
      }

      if (count > 0) {
        await batch.commit();
      }
      toast.success('Дедлайны успешно сохранены');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'deadlines');
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-full flex flex-col pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Управление расписанием</h2>
          <p className="text-zinc-400 text-sm mt-1">Редактирование дат по потокам и форматам</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 uppercase text-xs font-semibold tracking-widest hidden sm:inline">Поток:</span>
            <select
              value={selectedStream}
              onChange={e => setSelectedStream(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer text-sm"
            >
              {STREAMS.map(s => <option key={s} value={s}>Поток {s}</option>)}
            </select>
          </div>
          
          <button 
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl flex-1 overflow-auto custom-scrollbar bg-zinc-900/30 border border-zinc-800/50">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-zinc-500 animate-pulse">Загрузка расписания...</div>
        ) : (
          <div className="flex flex-col">
            {BLOCKS.map((block, idx) => (
              <div key={block.id} className={`p-6 md:p-8 flex flex-col xl:flex-row gap-6 ${idx !== BLOCKS.length - 1 ? 'border-b border-zinc-800/50' : ''} hover:bg-zinc-800/20 transition-colors`}>
                <div className="w-full xl:w-1/4 pt-1">
                  {block.title && <h3 className="text-lg font-bold text-blue-400 leading-tight">{block.title}</h3>}
                  <p className="text-zinc-500 text-sm mt-1 font-medium">{block.id}</p>
                </div>
                
                <div className="w-full xl:w-3/4 flex flex-col gap-4">
                  {FORMATS.map(f => {
                    const key = `${block.id}-${f}`;
                    const val = formData[key] || { startDate: '', endDate: '' };
                    return (
                      <div key={f} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 group">
                        <span className="w-full sm:w-32 sm:text-right text-zinc-400 group-hover:text-zinc-200 transition-colors font-medium text-sm">{f}</span>
                        <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                          <div className="flex flex-col w-[160px]">
                            <span className="text-[10px] uppercase text-zinc-600 ml-1 mb-1 font-bold tracking-wider">Дата открытия</span>
                            <input 
                              type="date" 
                              value={val.startDate}
                              onChange={e => handleChange(block.id, f, 'startDate', e.target.value)}
                              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert-[0.6]"
                            />
                          </div>
                          
                          <div className="hidden sm:flex self-end mb-2 text-zinc-700 font-light">-</div>
                          
                          <div className="flex flex-col w-[160px]">
                            <span className="text-[10px] uppercase text-zinc-600 ml-1 mb-1 font-bold tracking-wider">Дата окончания</span>
                            <input 
                              type="date" 
                              value={val.endDate}
                              onChange={e => handleChange(block.id, f, 'endDate', e.target.value)}
                              className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert-[0.6]"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
