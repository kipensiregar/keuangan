/**
 * Inventory Repository - Warung Medan Finance
 * Pengelolaan Stok Bahan Baku, Pemakaian Manual Harian, Valuasi Rata-rata Tertimbang (WAC)
 */

import { db } from '../db';
import type { Ingredient, StockMovement, StockMovementType, UnitType } from '../../types';

export const inventoryRepository = {
  async getAllIngredients(storeId?: string, eventId?: string): Promise<Ingredient[]> {
    return await db.ingredients.filter((i) => {
      if (!i.isActive) return false;
      if (storeId && storeId !== 'ALL' && i.storeId !== storeId) return false;
      if (eventId && i.eventId !== eventId) return false;
      // Unassigned legacy bazaar stock is shown only in the all-events view, never mixed into one event.
      if (storeId === 'store_bazar' && eventId && i.eventId !== eventId) return false;
      return true;
    }).toArray();
  },

  async getIngredientById(id: string): Promise<Ingredient | undefined> {
    return await db.ingredients.get(id);
  },

  async getMovements(ingredientId?: string, storeId?: string, eventId?: string): Promise<StockMovement[]> {
    if (ingredientId) {
      return await db.stockMovements
        .filter((m) => {
          if (m.ingredientId !== ingredientId) return false;
          if (storeId && storeId !== 'ALL' && m.storeId !== storeId) return false;
          if (eventId && m.eventId !== eventId) return false;
          return true;
        })
        .reverse()
        .sortBy('date');
    }
    if (storeId && storeId !== 'ALL') {
      return await db.stockMovements.filter((m) => m.storeId === storeId && (!eventId || m.eventId === eventId)).reverse().sortBy('date');
    }
    const all = await db.stockMovements.orderBy('date').reverse().toArray();
    return eventId ? all.filter((m) => m.eventId === eventId) : all;
  },

  /**
   * Tambah bahan baru ke master data
   */
  async createIngredient(data: {
    storeId?: string;
    name: string;
    category: string;
    unit: UnitType;
    initialStock: number;
    minimumStock: number;
    purchasePrice: number;
    defaultSupplier?: string;
    eventId?: string;
    secondaryUnit?: Ingredient['secondaryUnit'];
    initialStockSecondary?: number;
    minimumStockSecondary?: number;
  }): Promise<Ingredient> {
    const now = new Date().toISOString();
    const id = `ing_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const totalValuation = Math.round(data.initialStock * data.purchasePrice);
    const storeId = data.storeId || 'store_palembang_center';

    const ingredient: Ingredient = {
      id,
      storeId,
      name: data.name,
      category: data.category,
      unit: data.unit,
      initialStock: data.initialStock,
      currentStock: data.initialStock,
      minimumStock: data.minimumStock,
      eventId: data.eventId,
      secondaryUnit: data.secondaryUnit,
      initialStockSecondary: data.initialStockSecondary || 0,
      currentStockSecondary: data.initialStockSecondary || 0,
      minimumStockSecondary: data.minimumStockSecondary || 0,
      averagePurchasePrice: data.purchasePrice,
      totalValuation,
      defaultSupplier: data.defaultSupplier,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    await db.transaction('rw', [db.ingredients, db.stockMovements, db.auditLogs], async () => {
      await db.ingredients.add(ingredient);
      if (data.initialStock > 0 || (data.initialStockSecondary || 0) > 0) {
        const initMov: StockMovement = {
          id: `mov_init_${Date.now()}`,
          storeId,
          eventId: data.eventId,
          ingredientId: id,
          ingredientName: data.name,
          date: now.slice(0, 10),
          type: 'MASUK_PEMBELIAN',
          quantity: data.initialStock,
          unit: data.unit,
          secondaryQuantity: data.initialStockSecondary || 0,
          unitPrice: data.purchasePrice,
          totalAmount: totalValuation,
          notes: 'Stok awal master bahan',
          createdAt: now,
          updatedAt: now
        };
        await db.stockMovements.add(initMov);
      }

      await db.auditLogs.add({
        id: `audit_${Date.now()}`,
        action: 'ADD_INGREDIENT',
        entityType: 'INGREDIENT',
        entityId: id,
        details: `Tambah bahan baku: ${data.name} (${data.initialStock} ${data.unit}${data.secondaryUnit ? ` + ${data.initialStockSecondary || 0} ${data.secondaryUnit}` : ''})`,
        timestamp: now
      });
    });

    return ingredient;
  },

  /**
   * Perbarui data master tanpa mengubah saldo stok dan harga rata-rata,
   * agar riwayat transaksi serta valuasi persediaan tetap konsisten.
   */
  async updateIngredient(id: string, data: {
    name: string;
    category: string;
    minimumStock: number;
    minimumStockSecondary?: number;
    defaultSupplier?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    await db.transaction('rw', [db.ingredients, db.auditLogs], async () => {
      const existing = await db.ingredients.get(id);
      if (!existing || !existing.isActive) throw new Error('Bahan baku tidak ditemukan atau sudah dinonaktifkan');
      await db.ingredients.update(id, {
        name: data.name.trim(),
        category: data.category,
        minimumStock: data.minimumStock,
        minimumStockSecondary: data.minimumStockSecondary || 0,
        defaultSupplier: data.defaultSupplier?.trim() || undefined,
        updatedAt: now
      } as Partial<Ingredient>);
      await db.auditLogs.add({
        id: `audit_${Date.now()}`,
        action: 'UPDATE_INGREDIENT',
        storeId: existing.storeId,
        entityType: 'INGREDIENT',
        entityId: id,
        details: `Perbarui master bahan: ${existing.name} → ${data.name.trim()}`,
        timestamp: now
      });
    });
  },

  /**
   * Hapus secara aman (soft delete). Riwayat stok tetap disimpan.
   */
  async deactivateIngredient(id: string): Promise<void> {
    const now = new Date().toISOString();
    await db.transaction('rw', [db.ingredients, db.auditLogs], async () => {
      const existing = await db.ingredients.get(id);
      if (!existing || !existing.isActive) throw new Error('Bahan baku tidak ditemukan atau sudah dihapus');
      await db.ingredients.update(id, { isActive: false, updatedAt: now });
      await db.auditLogs.add({
        id: `audit_${Date.now()}`,
        action: 'DEACTIVATE_INGREDIENT',
        storeId: existing.storeId,
        entityType: 'INGREDIENT',
        entityId: id,
        details: `Nonaktifkan bahan baku: ${existing.name}. Riwayat stok dipertahankan.`,
        timestamp: now
      });
    });
  },

  /**
   * Catat Pergerakan Stok:
   * - MASUK_PEMBELIAN -> Tambah stok & hitung Weighted Average Cost (WAC)
   * - PEMAKAIAN_MANUAL -> Kurangi stok (pemakaian resep/dapur harian)
   * - RUSAK_TERBUANG -> Kurangi stok (bahan busuk, tumpah, layu)
   * - PENYESUAIAN_OPNAME -> Koreksi stok ke angka fisik riil
   */
  async recordMovement(payload: {
    storeId?: string;
    eventId?: string;
    ingredientId: string;
    date: string;
    type: StockMovementType;
    quantity: number;
    unitPrice?: number;
    notes?: string;
    relatedTransactionId?: string;
    fromStoreId?: string;
    toStoreId?: string;
    isInterStoreTransfer?: boolean;
    secondaryQuantity?: number;
    expectedQuantity?: number;
    expectedSecondaryQuantity?: number;
    sourceName?: string;
    responsibleParty?: StockMovement['responsibleParty'];
    receivedBy?: string;
    discrepancyNotes?: string;
  }): Promise<StockMovement> {
    if (payload.quantity < 0 || (payload.quantity === 0 && payload.type !== 'PENYESUAIAN_OPNAME')) {
      throw new Error('Jumlah stok harus lebih besar dari 0, kecuali koreksi opname dapat bernilai 0.');
    }

    const now = new Date().toISOString();
    const movId = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    return await db.transaction('rw', [db.ingredients, db.stockMovements, db.auditLogs], async () => {
      const ing = await db.ingredients.get(payload.ingredientId);
      if (!ing) throw new Error('Bahan baku tidak ditemukan');

      const storeId = payload.storeId || ing.storeId;
      let newStock = ing.currentStock;
      let newAvgPrice = ing.averagePurchasePrice;
      let movementTotalAmount = 0;
      let newStockSecondary = ing.currentStockSecondary || 0;

      if (payload.type === 'MASUK_PEMBELIAN') {
        const purchasePrice = payload.unitPrice ?? ing.averagePurchasePrice;
        movementTotalAmount = Math.round(payload.quantity * purchasePrice);

        // Weighted Average Cost Formula:
        // (Old Total Cost + New Purchase Cost) / (Old Quantity + New Quantity)
        const oldTotalCost = ing.currentStock * ing.averagePurchasePrice;
        const newTotalCost = oldTotalCost + movementTotalAmount;
        newStock = ing.currentStock + payload.quantity;
        newStockSecondary += payload.secondaryQuantity || 0;
        newAvgPrice = newStock > 0 ? Math.round(newTotalCost / newStock) : purchasePrice;
      } else if (payload.type === 'PEMAKAIAN_MANUAL' || payload.type === 'RUSAK_TERBUANG' || payload.type === 'KELUAR_BAZAR') {
        if (payload.quantity > ing.currentStock) throw new Error(`Stok ${ing.name} tidak cukup. Tersedia ${ing.currentStock} ${ing.unit}.`);
        if (ing.secondaryUnit && (payload.secondaryQuantity || 0) > (ing.currentStockSecondary || 0)) throw new Error(`Stok ${ing.name} tidak cukup. Tersedia ${ing.currentStockSecondary || 0} ${ing.secondaryUnit}.`);
        newStock = Math.max(0, ing.currentStock - payload.quantity);
        newStockSecondary = Math.max(0, newStockSecondary - (payload.secondaryQuantity || 0));
        movementTotalAmount = Math.round(payload.quantity * ing.averagePurchasePrice);
      } else if (payload.type === 'PENYESUAIAN_OPNAME') {
        // Pada koreksi opname, quantity yang diinput adalah stok fisik baru
        const delta = payload.quantity - ing.currentStock;
        newStock = payload.quantity;
        if (ing.secondaryUnit) newStockSecondary = payload.secondaryQuantity ?? newStockSecondary;
        movementTotalAmount = Math.round(Math.abs(delta) * ing.averagePurchasePrice);
      }

      const newTotalValuation = Math.round(newStock * newAvgPrice);

      await db.ingredients.update(payload.ingredientId, {
        currentStock: newStock,
        currentStockSecondary: newStockSecondary,
        averagePurchasePrice: newAvgPrice,
        totalValuation: newTotalValuation,
        updatedAt: now
      });

      const movement: StockMovement = {
        id: movId,
        storeId,
        eventId: payload.eventId || ing.eventId,
        ingredientId: ing.id,
        ingredientName: ing.name,
        date: payload.date,
        type: payload.type,
        quantity: payload.quantity,
        unit: ing.unit,
        secondaryQuantity: payload.secondaryQuantity,
        secondaryUnit: ing.secondaryUnit,
        expectedQuantity: payload.expectedQuantity,
        expectedSecondaryQuantity: payload.expectedSecondaryQuantity,
        sourceName: payload.sourceName,
        responsibleParty: payload.responsibleParty,
        receivedBy: payload.receivedBy,
        discrepancyNotes: payload.discrepancyNotes,
        unitPrice: payload.unitPrice ?? ing.averagePurchasePrice,
        totalAmount: movementTotalAmount,
        notes: payload.notes,
        relatedTransactionId: payload.relatedTransactionId,
        fromStoreId: payload.fromStoreId,
        toStoreId: payload.toStoreId,
        isInterStoreTransfer: payload.isInterStoreTransfer,
        createdAt: now,
        updatedAt: now
      };

      await db.stockMovements.add(movement);

      await db.auditLogs.add({
        id: `audit_${Date.now()}`,
        action: 'STOCK_MOVEMENT',
        storeId,
        entityType: 'INGREDIENT',
        entityId: ing.id,
        details: `${payload.type}: ${ing.name} qty ${payload.quantity} ${ing.unit}${ing.secondaryUnit ? ` + ${payload.secondaryQuantity || 0} ${ing.secondaryUnit}` : ''} (Sisa: ${newStock} ${ing.unit}${ing.secondaryUnit ? ` + ${newStockSecondary} ${ing.secondaryUnit}` : ''})${payload.discrepancyNotes ? `; SELISIH: ${payload.discrepancyNotes}` : ''}`, 
        timestamp: now
      });

      return movement;
    });
  },

  /**
   * Hitung total valuasi persediaan bahan baku terkini
   */
  async getTotalValuation(storeId?: string): Promise<number> {
    const ingredients = await db.ingredients
      .filter((i) => i.isActive && (!storeId || storeId === 'ALL' || i.storeId === storeId))
      .toArray();
    return ingredients.reduce((sum, item) => sum + item.totalValuation, 0);
  },

  /**
   * Ambil daftar bahan yang stoknya berada di bawah stok minimum
   */
  async getLowStockAlerts(storeId?: string, eventId?: string): Promise<Ingredient[]> {
    const ingredients = await db.ingredients
      .filter((i) => i.isActive && (!storeId || storeId === 'ALL' || i.storeId === storeId) && (!eventId || i.eventId === eventId))
      .toArray();
    return ingredients.filter((i) => i.currentStock <= i.minimumStock || (!!i.secondaryUnit && (i.currentStockSecondary || 0) <= (i.minimumStockSecondary || 0)));
  }
};
