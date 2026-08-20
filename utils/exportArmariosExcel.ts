import * as XLSX from 'xlsx';
import { Locker, LockerStatus } from '../types-armarios';
import { StorageService } from '../services/storage';

/**
 * Exporta dados exclusivamente dos armários que estão sob empréstimo para um arquivo Excel (.xlsx).
 * Colunas: Número do Armário, Matrícula, Nome, E-mail.
 */
export async function exportBorrowedLockersToExcel(lockers: Locker[]): Promise<void> {
  const borrowedLockers = lockers.filter(l => l.status === LockerStatus.OCCUPIED || l.currentLoan);

  if (borrowedLockers.length === 0) {
    alert('Não há armários emprestados para exportar no momento.');
    return;
  }

  const rows = await Promise.all(
    borrowedLockers.map(async (locker) => {
      const loan = locker.currentLoan;
      const registration = loan?.registrationNumber || '';
      const name = loan?.studentName || 'Não Informado';
      let email = loan?.studentEmail || '';

      if (!email && registration) {
        try {
          const dbEmail = await StorageService.getPersonEmail(registration);
          if (dbEmail) email = dbEmail;
        } catch (e) {
          console.warn(`Não foi possível buscar o e-mail para a matrícula ${registration}`, e);
        }
      }

      return {
        'Número do Armário': locker.number,
        'Matrícula': registration,
        'Nome': name,
        'E-mail': email || 'Sem e-mail'
      };
    })
  );

  // Criar planilha XLSX
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Configurar largura das colunas
  worksheet['!cols'] = [
    { wch: 20 }, // Número do Armário
    { wch: 22 }, // Matrícula
    { wch: 40 }, // Nome
    { wch: 40 }  // E-mail
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Armários Emprestados');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `armarios_emprestados_${dateStr}.xlsx`);
}
