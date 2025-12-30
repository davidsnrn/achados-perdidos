
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

  // Tenta detectar o separador (vírgula ou ponto-e-vírgula)
  const firstLine = lines[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount >= commaCount ? ';' : ',';

  const lockersMap: Record<number, Locker> = {};
  let lastSeenLockerNumber: number | null = null;

  // Função auxiliar para converter notação científica (2,01911E+13) para string
  const formatRegistration = (reg: string) => {
    if (!reg) return "";
    reg = reg.trim();
    // Se for notação científica (ex: 2,019...E+13)
    if (reg.toUpperCase().includes('E+') && (reg.includes(',') || reg.includes('.'))) {
      try {
        // Substitui vírgula por ponto para o JS entender como float
        const normalized = reg.replace(',', '.');
        const num = parseFloat(normalized);
        if (!isNaN(num)) {
          // Converte para string sem notação científica
          return BigInt(Math.round(num)).toString();
        }
      } catch (e) {
        return reg;
      }
    }
    return reg;
  };

  // Função para dar split respeitando aspas (campo "texto com ; aqui")
  const splitCSVLine = (text: string, delim: string) => {
    const result = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delim && !inQuotes) {
        result.push(cur);
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  };

  // Pula o cabeçalho se ele contiver palavras típicas de header
  let startIdx = 0;
  if (lines[0].toLowerCase().includes('armário') || lines[0].toLowerCase().includes('localização') || lines[0].toLowerCase().includes('matrícula')) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const parts = splitCSVLine(line, delimiter);

    let rawNumber = parts[0]?.trim() || '';
    let location = parts[1]?.trim() || '';
    let regNumber = formatRegistration(parts[2]?.trim() || '');
    let name = parts[3]?.trim() || '';
    let studentClass = parts[4]?.trim() || '';
    let observation = parts[5]?.trim() || '';
    let loanDateStr = parts[6]?.trim() || '';
    let returnDateStr = parts[7]?.trim() || '';

    // Tratamento para quando o número do armário está vazio mas a localização tem o número
    if (rawNumber === "" && !isNaN(parseInt(location))) {
      rawNumber = location;
      location = "";
    }

    let lockerNum = parseInt(rawNumber);
    if (isNaN(lockerNum)) {
      if (lastSeenLockerNumber !== null) lockerNum = lastSeenLockerNumber;
      else continue;
    } else {
      lastSeenLockerNumber = lockerNum;
    }

    if (!lockersMap[lockerNum]) {
      lockersMap[lockerNum] = {
        number: lockerNum,
        status: LockerStatus.AVAILABLE,
        location: location || (lockerNum <= 200 ? 'Bloco Principal' : 'Bloco Anexo'),
        loanHistory: [],
        maintenanceHistory: [],
        currentLoan: undefined
      };
    }

    if (name || regNumber) {
      const loan: LoanData = {
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        lockerNumber: lockerNum,
        physicalLocation: location || lockersMap[lockerNum].location,
        registrationNumber: regNumber,
        studentName: name,
        studentClass: studentClass,
        loanDate: loanDateStr,
        returnDate: returnDateStr,
        observation: observation
      };

      const isCurrent = !returnDateStr || returnDateStr.trim() === "" || returnDateStr.toLowerCase().includes('aberto');

      if (isCurrent && !lockersMap[lockerNum].currentLoan) {
        lockersMap[lockerNum].currentLoan = loan;
        lockersMap[lockerNum].status = LockerStatus.OCCUPIED;
      } else {
        lockersMap[lockerNum].loanHistory.push(loan);
      }
    }
  }

  const finalLockers: Locker[] = Object.values(lockersMap);
  return finalLockers.sort((a, b) => a.number - b.number);
};
