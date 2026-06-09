import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase, Gasto } from './supabase';

const OFFLINE_QUEUE_KEY = 'offline_gastos_queue';

export interface OfflineGastoItem {
  id: string;
  empleado_id: string;
  empleado_nombre?: string | null;
  monto: number;
  categoria?: string | null;
  subcategoria?: string | null;
  metodo_pago: 'efectivo' | 'tarjeta' | 'tarjeta_credito' | 'tarjeta_debito';
  justificacion?: string | null;
  base64Foto?: string | null; // Foto en base64 para guardado offline
  fecha_comprobante?: string | null;
  proveedor?: string | null;
  cliente?: string | null;
  sucursal?: string | null;
  tipo_tarjeta?: string | null;
  ubicacion_registro?: string | null;
  created_at: string;
}

// Convertidor base64 a ArrayBuffer autónomo para subir archivos a Supabase en React Native
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const lookup = new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  let bufferLength = base64.length * 0.75;
  const len = base64.length;
  let p = 0;
  let encoded1, encoded2, encoded3, encoded4;

  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') bufferLength--;
  }

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  for (let i = 0; i < len; i += 4) {
    encoded1 = lookup[base64.charCodeAt(i)];
    encoded2 = lookup[base64.charCodeAt(i + 1)];
    encoded3 = lookup[base64.charCodeAt(i + 2)];
    encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < bufferLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < bufferLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }

  return arrayBuffer;
}

export const SyncService = {
  /**
   * Agrega un gasto a la cola local fuera de línea
   */
  async enqueueGasto(item: Omit<OfflineGastoItem, 'id' | 'created_at'>): Promise<void> {
    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: OfflineGastoItem[] = queueStr ? JSON.parse(queueStr) : [];

    const newItem: OfflineGastoItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      created_at: new Date().toISOString(),
    };

    queue.push(newItem);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  },

  /**
   * Obtiene la cola actual de gastos offline
   */
  async getOfflineQueue(): Promise<OfflineGastoItem[]> {
    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return queueStr ? JSON.parse(queueStr) : [];
  },

  /**
   * Intenta sincronizar todos los gastos en la cola local con Supabase
   * Retorna la cantidad de gastos sincronizados exitosamente
   */
  async syncPendingGastos(): Promise<number> {
    const isConnected = (await NetInfo.fetch()).isConnected;
    if (!isConnected) return 0;

    const queueStr = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueStr) return 0;

    const queue: OfflineGastoItem[] = JSON.parse(queueStr);
    if (queue.length === 0) return 0;

    const remainingQueue: OfflineGastoItem[] = [];
    let syncedCount = 0;

    for (const item of queue) {
      try {
        let publicUrl = '';

        // 1. Subir foto a Supabase Storage si existe
        if (item.base64Foto) {
          const fileName = `${item.empleado_id}/${Date.now()}.jpg`;
          const arrayBuffer = base64ToArrayBuffer(item.base64Foto);

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('tickets')
            .upload(fileName, arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) {
            throw new Error(`Storage upload error: ${uploadError.message}`);
          }

          const { data: urlData } = supabase.storage.from('tickets').getPublicUrl(fileName);
          publicUrl = urlData.publicUrl;
        }

        // 2. Insertar registro en Supabase Gastos Table
        const { error: dbError } = await supabase.from('gastos').insert([
          {
            empleado_id: item.empleado_id,
            empleado_nombre: item.empleado_nombre,
            monto: item.monto,
            categoria: item.categoria,
            subcategoria: item.subcategoria,
            metodo_pago: item.metodo_pago,
            justificacion: item.justificacion,
            foto_url: publicUrl || null,
            status: 'PENDING',
            fecha_comprobante: item.fecha_comprobante || new Date().toISOString().split('T')[0],
            proveedor: item.proveedor || null,
            cliente: item.cliente || null,
            sucursal: item.sucursal || null,
            tipo_tarjeta: item.tipo_tarjeta || null,
            ubicacion_registro: item.ubicacion_registro || 'Móvil (Offline Sync)',
            created_at: item.created_at,
          },
        ]);

        if (dbError) {
          throw new Error(`Database insert error: ${dbError.message}`);
        }

        syncedCount++;
      } catch (err) {
        console.error('Failed to sync offline item:', item.id, err);
        // Volver a encolar los elementos fallidos para reintentar después
        remainingQueue.push(item);
      }
    }

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    return syncedCount;
  },

  /**
   * Inicializa el listener de red para sincronizar de manera transparente
   */
  initNetworkSyncListener(onSyncComplete?: (count: number) => void) {
    return NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        this.syncPendingGastos().then((count) => {
          if (count > 0 && onSyncComplete) {
            onSyncComplete(count);
          }
        });
      }
    });
  },
};
