import React, { useState, useMemo } from 'react';
import { FoundItem, ItemStatus } from '../../types';
import { StorageService } from '../../services/storage';
import { Plus, Search, Trash2, RotateCcw, PackageCheck, Gift, Calendar, Filter } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
  items: FoundItem[];
  onUpdate: () => void;
}

type DateFilterType = 'ALL' | 'TODAY' | 'WEEK' | 'CUSTOM';

export const FoundItemsTab: React.FC<Props> = ({ items, onUpdate }) => {
  const [activeSubTab, setActiveSubTab] = useState<ItemStatus>(ItemStatus.AVAILABLE);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<FoundItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  
  // Date Filtering State
  const [dateFilter, setDateFilter] = useState<DateFilterType>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Derived state for filtered items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 1. Status Filter
      const matchesStatus = item.status === activeSubTab;
      
      // 2. Text Search (Description, Detailed, Location, ID)
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        item.description.toLowerCase().includes(term) ||
        (item.detailedDescription && item.detailedDescription.toLowerCase().includes(term)) ||
        item.locationFound.toLowerCase().includes(term) ||
        item.id.toString().includes(term);

      // 3. Date Filter
      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const itemDate = new Date(item.dateFound + 'T12:00:00'); // Ensure it's treated as local date roughly
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === 'TODAY') {
          matchesDate = itemDate.toDateString() === today.toDateString();
        } else if (dateFilter === 'WEEK') {
          const oneWeekAgo = new Date(today);
          oneWeekAgo.setDate(today.getDate() - 7);
          matchesDate = itemDate >= oneWeekAgo && itemDate <= new Date(); // Up to now
        } else if (dateFilter === 'CUSTOM' && startDate && endDate) {
          const start = new Date(startDate + 'T00:00:00');
          const end = new Date(endDate + 'T23:59:59');
          matchesDate = itemDate >= start && itemDate <= end;
        }
      }

      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [items, activeSubTab, searchTerm, dateFilter, startDate, endDate]);

  // Helper to calculate days in stock
  const getDaysInStock = (dateString: string) => {
    const foundDate = new Date(dateString + 'T12:00:00');
    const today = new Date();
    // Normalize to start of day for accurate day diff
    foundDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    
    const diffTime = Math.abs(today.getTime() - foundDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    if (diffDays === 0) return <span className="text-green-600 font-bold">Hoje</span>;
    if (diffDays === 1) return <span className="text-gray-700">Ontem</span>;
    return <span className="text-gray-700">Há {diffDays} dias</span>;
  };

  // Handlers
  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newItem: FoundItem = {
      id: editingItem ? editingItem.id : 0, // 0 will trigger auto-increment in service
      description: formData.get('description') as string,
      detailedDescription: formData.get('detailedDescription') as string,
      locationFound: formData.get('locationFound') as string,
      locationStored: formData.get('locationStored') as string,
      dateFound: formData.get('dateFound') as string,
      dateRegistered: editingItem ? editingItem.dateRegistered : new Date().toISOString(),
      status: editingItem ? editingItem.status : ItemStatus.AVAILABLE,
    };

    StorageService.saveItem(newItem);
    onUpdate();
    setShowModal(false);
    setEditingItem(null);
  };

  const handleDelete = (id: number) => {
    if (confirm('Tem certeza que deseja excluir este item?')) {
      StorageService.deleteItem(id);
      onUpdate();
    }
  };

  const handleReturn = (item: FoundItem) => {
    const receiver = prompt('Para quem o item está sendo devolvido? (Nome ou Matrícula)');
    if (receiver) {
      const updated = {
        ...item,
        status: ItemStatus.RETURNED,
        returnedTo: receiver,
        returnedDate: new Date().toISOString()
      };
      StorageService.saveItem(updated);
      onUpdate();
    }
  };

  const handleBatchDonate = () => {
    if (confirm(`Marcar ${selectedItems.length} itens como Doado/Descartado?`)) {
      selectedItems.forEach(id => {
        const item = items.find(i => i.id === id);
        if (item) {
          StorageService.saveItem({ ...item, status: ItemStatus.DISCARDED });
        }
      });
      setSelectedItems([]);
      onUpdate();
    }
  };

  const toggleSelection = (id: number) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex p-1 bg-gray-200 rounded-lg">
          {Object.values(ItemStatus).map((status) => (
            <button
              key={status}
              onClick={() => setActiveSubTab(status)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                activeSubTab === status 
                ? 'bg-white text-ifrn-darkGreen shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          {selectedItems.length > 0 && (
            <button 
              onClick={handleBatchDonate}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
            >
              <Gift size={16} /> Doar ({selectedItems.length})
            </button>
          )}
          <button 
            onClick={() => { setEditingItem(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen transition-colors text-sm w-full md:w-auto justify-center"
          >
            <Plus size={18} /> Novo Item
          </button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        {/* Text Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por ID, descrição (simples/detalhada) ou local..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-ifrn-green focus:border-transparent outline-none text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Date Filter Controls */}
        <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
          <Calendar size={16} className="text-gray-500 ml-2" />
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value as DateFilterType)}
            className="bg-transparent border-none text-sm text-gray-700 focus:ring-0 cursor-pointer py-1.5"
          >
            <option value="ALL">Todo o período</option>
            <option value="TODAY">Hoje</option>
            <option value="WEEK">Esta Semana</option>
            <option value="CUSTOM">Data Específica</option>
          </select>
          
          {dateFilter === 'CUSTOM' && (
            <div className="flex items-center gap-1 pl-2 border-l border-gray-300 animate-fadeIn">
              <input 
                type="date" 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-white"
              />
              <span className="text-gray-400">-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="bg-gray-50 text-gray-700 font-semibold uppercase text-xs">
              <tr>
                {activeSubTab === ItemStatus.AVAILABLE && (
                  <th className="p-4 w-4">
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedItems(filteredItems.map(i => i.id));
                        else setSelectedItems([]);
                      }}
                      checked={filteredItems.length > 0 && selectedItems.length === filteredItems.length}
                    />
                  </th>
                )}
                <th className="p-4">ID</th>
                <th className="p-4">Descrição</th>
                <th className="p-4">Local Achado</th>
                <th className="p-4">Guardado Em</th>
                <th className="p-4">Tempo no Estoque</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-400">Nenhum item encontrado com os filtros atuais.</td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                     {activeSubTab === ItemStatus.AVAILABLE && (
                      <td className="p-4">
                        <input 
                          type="checkbox" 
                          checked={selectedItems.includes(item.id)}
                          onChange={() => toggleSelection(item.id)}
                        />
                      </td>
                    )}
                    <td className="p-4 font-mono font-bold text-ifrn-darkGreen">#{item.id}</td>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{item.description}</div>
                      {item.detailedDescription && (
                        <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">{item.detailedDescription}</div>
                      )}
                    </td>
                    <td className="p-4">{item.locationFound}</td>
                    <td className="p-4">{item.locationStored}</td>
                    <td className="p-4">
                      <div className="flex flex-col">
                        {getDaysInStock(item.dateFound)}
                        <span className="text-[10px] text-gray-400">{new Date(item.dateFound).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center gap-2">
                        {item.status === ItemStatus.AVAILABLE && (
                          <button 
                            onClick={() => handleReturn(item)}
                            title="Devolver"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <PackageCheck size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => { setEditingItem(item); setShowModal(true); }}
                          title="Editar"
                          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          <Search size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          title="Excluir"
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        title={editingItem ? `Editar Item #${editingItem.id}` : 'Cadastrar Novo Item'}
      >
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Curta *</label>
            <input name="description" required defaultValue={editingItem?.description} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Ex: Garrafa Azul" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Data que foi achado *</label>
            <input type="date" name="dateFound" required defaultValue={editingItem?.dateFound || new Date().toISOString().split('T')[0]} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Detalhada</label>
            <textarea name="detailedDescription" rows={3} defaultValue={editingItem?.detailedDescription} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Marca, detalhes de avaria, conteúdo..." />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Local onde foi achado *</label>
            <input name="locationFound" required defaultValue={editingItem?.locationFound} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Ex: Auditório" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Local de Armazenamento *</label>
            <input name="locationStored" required defaultValue={editingItem?.locationStored} className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-ifrn-green outline-none" placeholder="Ex: Armário 1" />
          </div>
          <div className="col-span-2 pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button type="submit" className="px-6 py-2 bg-ifrn-green text-white rounded-lg hover:bg-ifrn-darkGreen font-medium">Salvar</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};