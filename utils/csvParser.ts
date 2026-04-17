
import { Locker, LockerStatus, LoanData, Student } from '../types-armarios';

export const parseStudentCSV = (csvText: string): Student[] => {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const students: Student[] = [];

  // Pula o cabeçalho (#;Nome;Matrícula;Curso...)
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 4) continue;

    const registration = parts[2]?.trim();
    const name = parts[1]?.trim();
    const fullCourse = parts[3]?.trim() || '';
    const situation = parts[6]?.trim();
    const email = parts[7]?.trim();

    if (registration && name) {
      // Tenta extrair uma sigla de turma curta do nome do curso longo
      // Ex: "13500 - Técnico ... em Administração" -> "ADM SUB"
      let studentClass = "IFRN";
      if (fullCourse.toLowerCase().includes('administração')) studentClass = 'ADM';
      if (fullCourse.toLowerCase().includes('informática')) studentClass = 'INFO';
      if (fullCourse.toLowerCase().includes('química')) studentClass = 'QUIM';
      if (fullCourse.toLowerCase().includes('análise')) studentClass = 'TADS';

      if (fullCourse.toLowerCase().includes('subsequente')) studentClass += ' SUB';
      if (fullCourse.toLowerCase().includes('integrada') || fullCourse.toLowerCase().includes('integrado')) studentClass += ' INT';

      students.push({
        registration,
        name,
        course: studentClass,
        situation,
        email
      });
    }
  }
  return students;
};

export const parseIFRNCSV = (csvText: string): Locker[] => {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Tenta detectar o separador (vírgula ou ponto-e-vírgula) percorrendo as primeiras linhas
  let delimiter = ',';
  for (const line of lines) {
    const semicolonCount = (line.match(/;/g) || []).length;
    const commaCount = (line.match(/,/g) || []).length;
    if (semicolonCount > 0 || commaCount > 0) {
      delimiter = semicolonCount >= commaCount ? ';' : ',';
      break;
    }
  }

  const lockersMap: Record<string, Locker> = {};
  let lastSeenLockerNumber: string | null = null;

  const formatRegistration = (reg: string) => {
    if (!reg) return "";
    reg = reg.trim();
    if (reg.toUpperCase().includes('E+') || (reg.toUpperCase().includes('E') && reg.match(/\d+E\d+/))) {
      try {
        const normalized = reg.replace(',', '.').toUpperCase();
        const [base, exp] = normalized.split('E');
        const exponent = parseInt(exp.replace('+', ''), 10);
        if (isNaN(exponent)) return reg;
        const parts = base.split('.');
        const integerPart = parts[0];
        const fractionalPart = parts[1] || "";
        if (exponent >= fractionalPart.length) {
          return integerPart + fractionalPart.padEnd(exponent, '0');
        } else {
          return integerPart + fractionalPart.substring(0, exponent);
        }
      } catch (e) { return reg; }
    }
    return reg;
  };

  const splitCSVLine = (text: string, delim: string) => {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === delim && !inQuotes) { result.push(cur); cur = ""; }
      else cur += char;
    }
    result.push(cur);
    return result;
  };

  let startIdx = 0;
  if (lines[0].toLowerCase().includes('armário') || lines[0].toLowerCase().includes('localização') || lines[0].toLowerCase().includes('matrícula')) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const parts = splitCSVLine(lines[i], delimiter);

    let rawNumber = parts[0]?.trim() || '';
    let location = parts[1]?.trim() || '';
    let regNumber = formatRegistration(parts[2]?.trim() || '');
    let name = parts[3]?.trim() || '';
    let studentClass = parts[4]?.trim() || '';
    let observation = parts[5]?.trim() || '';
    let loanDateStr = parts[6]?.trim() || '';
    let returnDateStr = parts[7]?.trim() || '';

    if (rawNumber === "" && location && !isNaN(parseInt(location))) {
      rawNumber = location;
      location = "";
    }

    let lockerId = rawNumber;

    if (lockerId === "") {
      if (lastSeenLockerNumber !== null) lockerId = lastSeenLockerNumber;
      else continue;
    } else {
      lastSeenLockerNumber = lockerId;
    }

    // Sanity check: se for uma matrícula (longa e numérica), provavelmente é um erro de coluna
    if (lockerId.length > 10 && !isNaN(parseInt(lockerId))) {
      continue;
    }

    if (!lockersMap[lockerId]) {
      lockersMap[lockerId] = {
        number: lockerId,
        status: LockerStatus.AVAILABLE,
        location: location || (parseInt(lockerId) <= 200 ? 'Bloco Principal' : 'Bloco Anexo'),
        loanHistory: [],
        maintenanceHistory: [],
        currentLoan: undefined
      };
    }

    if (name || regNumber) {
      const loan: LoanData = {
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        lockerNumber: lockerId,
        physicalLocation: location || lockersMap[lockerId].location,
        registrationNumber: regNumber,
        studentName: name,
        studentClass: studentClass,
        loanDate: loanDateStr,
        returnDate: returnDateStr,
        observation: observation
      };

      const isCurrent = !returnDateStr || returnDateStr.trim() === "" || returnDateStr.toLowerCase().includes('aberto');
      if (isCurrent && !lockersMap[lockerId].currentLoan) {
        lockersMap[lockerId].currentLoan = loan;
        lockersMap[lockerId].status = LockerStatus.OCCUPIED;
      } else {
        lockersMap[lockerId].loanHistory.push(loan);
      }
    }
  }

  return Object.values(lockersMap).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: 'base' }));
};
