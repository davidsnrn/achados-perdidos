# Plano: Adicionar seleção por Sala na Verificação

## Arquivo a modificar
`components/Tabs/TeacherAttendanceTab.tsx` (3913 linhas)

## O que será feito

### 1. Novos estados (após linha 162)
Adicionar após `const [selectedShift, setSelectedShift] = useState<'M' | 'T' | 'N'>('M');`:
```typescript
const [verificationViewMode, setVerificationViewMode] = useState<'turma' | 'sala'>('turma');
const [selectedRoom, setSelectedRoom] = useState<string>('');
```

### 2. Novo useEffect (antes do "Global keydown" ~linha 356)
```typescript
useEffect(() => {
  if (verificationViewMode === 'sala' && selectedRoom) {
    const roomClasses = classes
      .filter(c => c.room?.trim() === selectedRoom)
      .map(c => c.name)
      .sort();
    setSelectedClasses(roomClasses);
  }
}, [selectedRoom, verificationViewMode, classes]);
```

### 3. Novo valor computado (após `uniqueClasses` linha 1322)
```typescript
const uniqueRooms = [...new Set(
  classes.filter(c => c.room?.trim()).map(c => c.room!.trim())
)].sort();
```

### 4. Toggle Turma/Sala e selector condicional (substituir linhas 1554-1637)
Substituir o bloco do multi-select de turmas por:

1. **Toggle "Turma" | "Sala"** - dois botões estilo tab
2. **Condicional**:
   - Modo `turma`: mantém o multi-select de turmas existente
   - Modo `sala`: mostra um `<select>` único com as salas disponíveis

### 5. Texto do estado vazio (linha 2656)
Mudar de:
```tsx
Selecione as turmas no filtro acima...
```
Para:
```tsx
{verificationViewMode === 'sala'
  ? 'Selecione a sala no filtro acima para visualizar a grade de horários e registrar a frequência.'
  : 'Selecione as turmas no filtro acima para visualizar a grade de horários e registrar a frequência.'
}
```

## Fluxo de uso
1. Usuário entra na Verificação
2. Tem um toggle "Turma" | "Sala" ao lado dos controles de data/turno
3. **Modo Turma**: comportamento atual (multi-select de turmas)
4. **Modo Sala**: dropdown para selecionar uma sala → automaticamente popula `selectedClasses` com as turmas que usam aquela sala → grade exibe essas turmas como colunas
5. Grade permanece idêntica (colunas = turmas, linhas = horários, botões Presente/Substituído/Vago)
