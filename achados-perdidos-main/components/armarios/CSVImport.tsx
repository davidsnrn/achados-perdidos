import React, { useState } from 'react';
import { Locker, LockerStatus } from '../../types-armarios';
import { parseIFRNCSV, parseStudentCSV } from '../../utils/csvParser';
import { Student } from '../../types-armarios';

interface CSVImportProps {
  onImportLockers: (lockers: Locker[]) => void;
  onCancel: () => void;
}

const CSVImport: React.FC<CSVImportProps> = ({ onImportLockers, onCancel }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFile = (file: File) => {
    setError(null);
    setSuccess(null);
    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      setError("Por favor, selecione um arquivo .CSV válido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseIFRNCSV(text);
        onImportLockers(data);
        setSuccess(`${data.length} armários importados com sucesso!`);
      } catch (err) {
        setError("Erro ao processar o arquivo. Verifique o formato e o tipo selecionado.");
      }
    };
    reader.readAsText(file, 'ISO-8859-1');
  };

  return (
    <div className="max-w-2xl mx-auto my-10 animate-fade-in">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Central de Importação</h2>
          <p className="text-slate-500 mt-2 font-medium">Alimente o sistema com dados do IFRN</p>
        </div>



        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
          }}
          className={`
border - 4 border - dashed rounded - [2rem] p - 12 text - center transition - all cursor - pointer
            ${isDragging ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-slate-50 hover:bg-white'}
`}
          onClick={() => document.getElementById('fileInput')?.click()}
        >
          <input id="fileInput" type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-green-100 text-green-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Arraste o CSV de Histórico de Armários</p>
        </div>

        {error && <div className="mt-6 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-2 animate-bounce"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>{error}</div>}
        {success && <div className="mt-6 p-4 bg-green-50 text-green-600 rounded-2xl text-xs font-bold flex items-center gap-2"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>{success}</div>}

        <button onClick={onCancel} className="w-full mt-8 py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-colors">Voltar ao Painel</button>
      </div>
    </div>
  );
};

export default CSVImport;
