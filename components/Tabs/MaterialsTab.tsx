import React, { useState, useMemo } from 'react';
import { Material } from '../../types-materiais';
import { StorageService } from '../../services/storage';
import { Search, Plus, Edit2, Trash2, Hash, AlertTriangle, Copy, CheckCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';

interface Props {
    materials: Material[];
    onUpdate: () => void;
}

export const MaterialsTab: React.FC<Props> = ({ materials, onUpdate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [materialToDelete, setMaterialToDelete] = useState<Material | null>(null);

    // Success modal state
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [copiedCode, setCopiedCode] = useState(false);

    // Form state
    const [formName, setFormName] = useState('');

    const normalizeText = (text: string) => {
        return text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    };

    const filteredMaterials = useMemo(() => {
        const searchTerms = normalizeText(searchTerm).split(/\s+/).filter(t => t.length > 0);
        if (searchTerms.length === 0) return materials;

        return materials.filter(m => {
            const itemText = normalizeText(`${m.name} ${m.code}`);
            return searchTerms.every(term => itemText.includes(term));
        });
    }, [materials, searchTerm]);

    const generateCode = (): string => {
        // Generate unique sequential code: 001, 002, 003...
        const existingCodes = materials.map(m => m.code);
        let num = 1;
        while (existingCodes.includes(num.toString().padStart(3, '0'))) {
            num++;
        }
        return num.toString().padStart(3, '0');
    };

    const openAddForm = () => {
        setEditingMaterial(null);
        setFormName('');
        setShowForm(true);
    };

    const openEditForm = (material: Material) => {
        setEditingMaterial(material);
        setFormName(material.name);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const code = editingMaterial?.code || generateCode();
        const material: Material = {
            id: editingMaterial?.id || Math.random().toString(36).substr(2, 9),
            code: code,
            name: formName.trim(),
            createdAt: editingMaterial?.createdAt || new Date().toISOString()
        };

        try {
            await StorageService.saveMaterial(material);
            await onUpdate();
            setShowForm(false);

            if (!editingMaterial) {
                // Show success modal with generated code for new materials
                setGeneratedCode(code);
                setShowSuccessModal(true);
            } else {
                alert('Material atualizado!');
            }
        } catch (error: any) {
            console.error('Erro ao salvar material:', error);
            alert(`Erro ao salvar material: ${error.message || 'Verifique a conexão com o banco de dados.'}`);
        }
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(generatedCode);
            setCopiedCode(true);
            setTimeout(() => setCopiedCode(false), 2000);
        } catch (error) {
            alert('Erro ao copiar código.');
        }
    };

    const confirmDelete = async () => {
        if (!materialToDelete) return;

        try {
            await StorageService.deleteMaterial(materialToDelete.id);
            onUpdate();
            setShowDeleteConfirm(false);
            setMaterialToDelete(null);
            alert('Material excluído.');
        } catch (error) {
            alert('Erro ao excluir material.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-96">
                    <input
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        placeholder="Pesquisar por nome ou código..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                </div>

                <button
                    onClick={openAddForm}
                    className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={20} /> Adicionar Material
                </button>
            </div>

            {/* Materials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMaterials.map(material => (
                    <div key={material.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="bg-indigo-100 p-1.5 rounded-md text-indigo-600">
                                        <Hash size={16} />
                                    </div>
                                    <span className="text-xs font-mono font-bold text-indigo-600">{material.code}</span>
                                </div>
                                <h3 className="font-bold text-gray-800 text-lg">{material.name}</h3>
                                <p className="text-xs text-gray-400 mt-1">
                                    Criado em {new Date(material.createdAt).toLocaleDateString()}
                                </p>
                            </div>

                            <div className="flex gap-1">
                                <button
                                    onClick={() => openEditForm(material)}
                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    title="Editar"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => {
                                        setMaterialToDelete(material);
                                        setShowDeleteConfirm(true);
                                    }}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredMaterials.length === 0 && (
                    <div className="col-span-full p-12 text-center text-gray-400 italic">
                        Nenhum material encontrado.
                    </div>
                )}
            </div>

            {/* Form Modal */}
            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingMaterial ? 'Editar Material' : 'Novo Material'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {editingMaterial && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex items-center gap-2">
                            <Hash size={18} className="text-indigo-600" />
                            <span className="text-sm font-mono font-bold text-indigo-700">Código: {editingMaterial.code}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Material</label>
                        <input
                            type="text"
                            required
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                            className="w-full border-2 border-gray-100 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 transition-all"
                            placeholder="Ex: Adaptador HDMI"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            💡 Cada material cadastrado representa uma unidade física (ex: 5 grampeadores = 5 cadastros)
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                        <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" className="flex-[2] py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all">
                            {editingMaterial ? 'Salvar Alterações' : 'Cadastrar Material'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Success Modal with Code */}
            <Modal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} title="Material Cadastrado com Sucesso!">
                <div className="space-y-6">
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                            <CheckCircle className="text-green-600 flex-shrink-0" size={24} />
                            <div>
                                <h3 className="font-bold text-green-900">Material cadastrado!</h3>
                                <p className="text-sm text-green-700 mt-1">
                                    Cole o código abaixo no produto físico para rastreamento.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-6 text-center">
                        <p className="text-sm text-indigo-700 font-medium mb-2">CÓDIGO DE RASTREAMENTO</p>
                        <div className="bg-white border-2 border-indigo-400 rounded-lg p-4 mb-4">
                            <Hash size={32} className="text-indigo-600 mx-auto mb-2" />
                            <p className="text-4xl font-black font-mono text-indigo-900">{generatedCode}</p>
                        </div>

                        <button
                            onClick={copyToClipboard}
                            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${copiedCode
                                ? 'bg-green-600 text-white'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                        >
                            {copiedCode ? (
                                <>
                                    <CheckCircle size={20} /> Código Copiado!
                                </>
                            ) : (
                                <>
                                    <Copy size={20} /> Copiar Código
                                </>
                            )}
                        </button>
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                        <button
                            onClick={() => setShowSuccessModal(false)}
                            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirmar Exclusão">
                <div className="space-y-4">
                    <div className="bg-red-50 text-red-800 p-4 rounded-lg flex items-start gap-3 border border-red-200">
                        <AlertTriangle className="flex-shrink-0" size={20} />
                        <div className="text-sm">
                            <p className="font-bold">Atenção!</p>
                            <p className="mt-1">Deseja excluir o material <strong>{materialToDelete?.name}</strong> (Código: <strong>{materialToDelete?.code}</strong>)?</p>
                            <p className="mt-2 text-xs">Esta ação não poderá ser desfeita.</p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">
                            Cancelar
                        </button>
                        <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-bold flex items-center gap-2">
                            <Trash2 size={16} /> Sim, Excluir
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
