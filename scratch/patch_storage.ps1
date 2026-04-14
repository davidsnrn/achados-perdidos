$code = @"

  restockSupply: async (restock: Partial<SupplyRestock>) => {
    // 1. Get current supply
    const { data: supply } = await supabase
      .from('supplies')
      .select('quantity')
      .eq('id', restock.supply_id)
      .single();

    if (!supply) throw new Error("Insumo n䯠encontrado.");

    const newQuantity = (supply.quantity || 0) + (restock.quantity_added || 0);

    // 2. Insert into history
    const { error: hError } = await supabase.from('supply_restock_history').insert({
      supply_id: restock.supply_id,
      campus_id: restock.campus_id,
      quantity_added: restock.quantity_added,
      operator_id: restock.operator_id,
      date: restock.date || new Date().toISOString()
    });
    if (hError) throw hError;

    // 3. Update supply quantity
    const { error: uError } = await supabase
      .from('supplies')
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq('id', restock.supply_id);

    if (uError) throw uError;
  },

  getRestockHistory: async (campusId?: string): Promise<SupplyRestock[]> => {
    let query = supabase.from('supply_restock_history').select('*').order('date', { ascending: false });
    if (campusId) query = query.eq('campus_id', campusId);
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  deleteRestockRecord: async (id: string, restoreStock: boolean = false) => {
    if (restoreStock) {
      const { data: record } = await supabase.from('supply_restock_history').select('*').eq('id', id).single();
      if (record) {
        const { data: supply } = await supabase.from('supplies').select('quantity').eq('id', record.supply_id).single();
        if (supply) {
          const newQuantity = Math.max(0, supply.quantity - record.quantity_added);
          await supabase.from('supplies')
            .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', record.supply_id);
        }
      }
    }
    const { error } = await supabase.from('supply_restock_history').delete().eq('id', id);
    if (error) throw error;
  }
};
"@

$filePath = "c:\Users\2413069\Desktop\Aplicativos\achados-perdidos-main\services\storage.ts"
$content = Get-Content $filePath -Raw
$newContent = $content -replace "\s*}\s*};\s*\z", (",`r`n`n" + $code)
Set-Content $filePath $newContent -NoNewline
