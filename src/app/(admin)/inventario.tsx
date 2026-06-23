import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomButton from '@/components/CustomButton';
import CustomInput from '@/components/CustomInput';

// Interfaces locales coincidentes con el esquema de base de datos
interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
}

interface Proveedor {
  id: string;
  nombre: string;
  rfc?: string;
}

interface Producto {
  id: string;
  sku_interno: string;
  nombre_oficial: string;
  categoria_id: string;
  stock_actual: number;
  activo: boolean;
}

interface FacturaItemStaging {
  id: string;
  nombreFactura: string;
  cantidad: number;
  precioUnitario: number;
  productoIdSugerido?: string;
  esNuevoProducto: boolean;
  categoriaSeleccionadaId?: string;
}

export default function AdminInventario() {
  const router = useRouter();
  const scheme = useColorScheme();
  const themeColors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // --- Estados de Datos ---
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- Estados de Interfaz ---
  const [activeTab, setActiveTab] = useState<'catalogo' | 'ia-import' | 'categorias'>('catalogo');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // --- Estados CRUD manual ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null);
  const [formSku, setFormSku] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formCategoriaId, setFormCategoriaId] = useState('');
  const [formStock, setFormStock] = useState(0);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // --- Estados Gestión Masiva ---
  const [sourceCatId, setSourceCatId] = useState('');
  const [destCatId, setDestCatId] = useState('');
  const [isMovingMassive, setIsMovingMassive] = useState(false);

  // --- Estados Staging Facturas IA ---
  const [selectedProveedorId, setSelectedProveedorId] = useState('');
  const [folioFactura, setFolioFactura] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stagingItems, setStagingItems] = useState<FacturaItemStaging[]>([]);
  const [isCommittingIA, setIsCommittingIA] = useState(false);

  // --- Inicialización y Carga ---
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      // Cargar Categorías
      const { data: catData, error: catErr } = await supabase
        .from('categorias')
        .select('*')
        .order('nombre');
      if (catErr) throw catErr;
      setCategorias(catData || []);

      // Cargar Proveedores
      const { data: provData, error: provErr } = await supabase
        .from('proveedores')
        .select('*')
        .order('nombre');
      if (provErr) throw provErr;
      setProveedores(provData || []);

      // Cargar Productos Activos (Soft Delete = activo true)
      const { data: prodData, error: prodErr } = await supabase
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre_oficial');
      if (prodErr) throw prodErr;
      setProductos(prodData || []);
    } catch (err: any) {
      console.error('Error al cargar datos de inventario:', err);
      Alert.alert('Error', err.message || 'No se pudo cargar la información de inventario.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers: CRUD Manual ---
  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormSku('');
    setFormNombre('');
    setFormCategoriaId(categorias[0]?.id || '');
    setFormStock(0);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Producto) => {
    setEditingProduct(p);
    setFormSku(p.sku_interno);
    setFormNombre(p.nombre_oficial);
    setFormCategoriaId(p.categoria_id);
    setFormStock(p.stock_actual);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!formSku.trim() || !formNombre.trim() || !formCategoriaId) {
      Alert.alert('Campos Incompletos', 'Por favor llena todos los campos obligatorios.');
      return;
    }

    setIsSavingProduct(true);
    try {
      if (editingProduct) {
        // Actualizar existente
        const { error } = await supabase
          .from('productos')
          .update({
            sku_interno: formSku.trim(),
            nombre_oficial: formNombre.trim(),
            categoria_id: formCategoriaId,
            stock_actual: formStock,
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        Alert.alert('Éxito', 'Producto actualizado correctamente.');
      } else {
        // Crear nuevo
        const { error } = await supabase
          .from('productos')
          .insert([{
            sku_interno: formSku.trim(),
            nombre_oficial: formNombre.trim(),
            categoria_id: formCategoriaId,
            stock_actual: formStock,
            activo: true,
          }]);

        if (error) throw error;
        Alert.alert('Éxito', 'Producto registrado correctamente.');
      }
      setIsModalOpen(false);
      await fetchInitialData();
    } catch (err: any) {
      Alert.alert('Error al guardar', err.message || 'Ocurrió un problema.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleSoftDelete = async (id: string, name: string) => {
    const performSoftDelete = async () => {
      try {
        const { error } = await supabase
          .from('productos')
          .update({ activo: false })
          .eq('id', id);

        if (error) throw error;
        Alert.alert('Desactivado', 'El producto ha sido desactivado del catálogo.');
        await fetchInitialData();
      } catch (err: any) {
        Alert.alert('Error', err.message || 'No se pudo desactivar el producto.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`¿Estás seguro de que deseas desactivar a ${name}?`)) {
        await performSoftDelete();
      }
    } else {
      Alert.alert('Confirmar Desactivación', `¿Estás seguro de desactivar ${name}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desactivar', style: 'destructive', onPress: performSoftDelete },
      ]);
    }
  };

  // --- Handlers: Gestión Masiva ---
  const handleBulkMove = async () => {
    if (!sourceCatId || !destCatId) {
      Alert.alert('Error', 'Selecciona la categoría de origen y la de destino.');
      return;
    }
    if (sourceCatId === destCatId) {
      Alert.alert('Error', 'La categoría de origen y destino no pueden ser iguales.');
      return;
    }

    setIsMovingMassive(true);
    try {
      const { data, error } = await supabase
        .from('productos')
        .update({ categoria_id: destCatId })
        .eq('categoria_id', sourceCatId)
        .eq('activo', true);

      if (error) throw error;
      Alert.alert('Éxito', 'Los productos activos se transfirieron correctamente.');
      setSourceCatId('');
      setDestCatId('');
      await fetchInitialData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron transferir los productos.');
    } finally {
      setIsMovingMassive(false);
    }
  };

  // --- Handlers: IA Flow Staging ---
  const handleSimulateOcr = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      // Mapear simulaciones con items semilla
      const mockItems: FacturaItemStaging[] = [
        {
          id: 'ia-1',
          nombreFactura: 'PANEL SOLAR BIFACIAL RENESOLA 640W LS',
          cantidad: 20,
          precioUnitario: 3400,
          productoIdSugerido: productos.find(p => p.sku_interno === 'SOL-REN-640W-BIF')?.id,
          esNuevoProducto: false,
        },
        {
          id: 'ia-2',
          nombreFactura: 'SOLIS INVERTER S6-GR1P6K-S SINGLE PHASE',
          cantidad: 5,
          precioUnitario: 14500,
          productoIdSugerido: productos.find(p => p.sku_interno === 'SOL-SOLIS-6K')?.id,
          esNuevoProducto: false,
        },
        {
          id: 'ia-3',
          nombreFactura: 'CABLE FV ROJO CONDUCTORES 4MM2',
          cantidad: 1000,
          precioUnitario: 17.8,
          productoIdSugerido: productos.find(p => p.sku_interno === 'CAB-FV-4MM-R')?.id,
          esNuevoProducto: false,
        },
        {
          id: 'ia-4',
          nombreFactura: 'CONDULET LL ALU 3/4 CON TAPA', // Desconocido / Nuevo
          cantidad: 15,
          precioUnitario: 110.0,
          esNuevoProducto: true,
          categoriaSeleccionadaId: categorias.find(c => c.nombre.includes('Canalización'))?.id || categorias[0]?.id,
        },
      ];
      setStagingItems(mockItems);
      setIsAnalyzing(false);
    }, 1500);
  };

  const handleUpdateStagingItem = (id: string, updates: Partial<FacturaItemStaging>) => {
    setStagingItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleCommitAI = async () => {
    if (!selectedProveedorId) {
      Alert.alert('Falta Proveedor', 'Selecciona el proveedor de la factura.');
      return;
    }
    if (!folioFactura.trim()) {
      Alert.alert('Falta Folio', 'Ingresa el número de folio de la factura.');
      return;
    }
    if (stagingItems.length === 0) {
      Alert.alert('Vacío', 'No hay registros en la tabla borrador.');
      return;
    }

    setIsCommittingIA(true);
    try {
      for (const item of stagingItems) {
        let pId = item.productoIdSugerido;

        if (item.esNuevoProducto) {
          // 1. Crear el producto nuevo en el catálogo
          const skuGenerico = 'SKU-IA-' + Math.random().toString(36).substring(2, 9).toUpperCase();
          const { data: newProd, error: newProdErr } = await supabase
            .from('productos')
            .insert([{
              sku_interno: skuGenerico,
              nombre_oficial: item.nombreFactura,
              categoria_id: item.categoriaSeleccionadaId,
              stock_actual: item.cantidad,
              activo: true,
            }])
            .select()
            .single();

          if (newProdErr) throw newProdErr;
          pId = newProd.id;

          // 2. Guardar el Alias del Proveedor
          await supabase
            .from('alias_proveedor_producto')
            .insert([{
              proveedor_id: selectedProveedorId,
              producto_id: pId,
              nombre_segun_proveedor: item.nombreFactura,
            }]);
        } else if (pId) {
          // Actualizar stock del producto existente
          const prod = productos.find(p => p.id === pId);
          if (prod) {
            const nuevoStock = prod.stock_actual + item.cantidad;
            const { error: stockErr } = await supabase
              .from('productos')
              .update({ stock_actual: nuevoStock })
              .eq('id', pId);

            if (stockErr) throw stockErr;
          }
        }

        // 3. Registrar el movimiento de inventario (ENTRADA)
        if (pId) {
          await supabase
            .from('movimientos_inventario')
            .insert([{
              producto_id: pId,
              tipo: 'ENTRADA',
              cantidad: item.cantidad,
              folio_factura: folioFactura.trim(),
              proveedor_id: selectedProveedorId,
            }]);
        }
      }

      Alert.alert('Importación Exitosa', 'El inventario, movimientos y alias se guardaron correctamente.');
      setStagingItems([]);
      setFolioFactura('');
      setSelectedProveedorId('');
      setActiveTab('catalogo');
      await fetchInitialData();
    } catch (err: any) {
      Alert.alert('Error al registrar', err.message || 'Ocurrió un error guardando el borrador.');
    } finally {
      setIsCommittingIA(false);
    }
  };

  // Filtrado de catálogo
  const filteredProducts = productos.filter(p => {
    const matchesSearch = p.nombre_oficial.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku_interno.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategoryFilter ? p.categoria_id === selectedCategoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>Logística y Almacén</Text>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Control de Inventario</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => setActiveTab('catalogo')}
          style={[styles.tab, activeTab === 'catalogo' && { borderBottomColor: themeColors.accent, borderBottomWidth: 3 }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'catalogo' ? themeColors.text : themeColors.textSecondary }]}>Catálogo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('ia-import')}
          style={[styles.tab, activeTab === 'ia-import' && { borderBottomColor: themeColors.accent, borderBottomWidth: 3 }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'ia-import' ? themeColors.text : themeColors.textSecondary }]}>Carga IA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('categorias')}
          style={[styles.tab, activeTab === 'categorias' && { borderBottomColor: themeColors.accent, borderBottomWidth: 3 }]}
        >
          <Text style={[styles.tabText, { color: activeTab === 'categorias' ? themeColors.text : themeColors.textSecondary }]}>Categorías</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={themeColors.accent} />
          <Text style={{ color: themeColors.textSecondary, marginTop: 12 }}>Cargando información del inventario...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* TAB 1: CATALOGO */}
          {activeTab === 'catalogo' && (
            <View style={{ flex: 1 }}>
              {/* Filtros */}
              <View style={styles.filterSection}>
                <TextInput
                  placeholder="🔍 Buscar por nombre o SKU..."
                  placeholderTextColor={themeColors.textSecondary}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  style={[styles.searchInput, { backgroundColor: themeColors.backgroundElement, color: themeColors.text, borderColor: themeColors.border }]}
                />
                <View style={styles.pickerContainer}>
                  <select
                    value={selectedCategoryFilter}
                    onChange={e => setSelectedCategoryFilter(e.target.value)}
                    style={{
                      ...webStyles.select,
                      backgroundColor: themeColors.backgroundElement,
                      color: themeColors.text,
                      borderColor: themeColors.border
                    }}
                  >
                    <option value="">Todas las Categorías</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </View>
              </View>

              {/* Botón flotante para agregar manual */}
              <TouchableOpacity onPress={handleOpenCreateModal} style={[styles.floatingAddBtn, { backgroundColor: themeColors.accent }]}>
                <Ionicons name="add" size={26} color="#fff" />
              </TouchableOpacity>

              <FlatList
                data={filteredProducts}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const cat = categorias.find(c => c.id === item.categoria_id);
                  return (
                    <View style={[styles.itemCard, { backgroundColor: themeColors.backgroundElement, borderColor: themeColors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemSku, { color: themeColors.accent }]}>{item.sku_interno}</Text>
                        <Text style={[styles.itemTitle, { color: themeColors.text }]}>{item.nombre_oficial}</Text>
                        <Text style={[styles.itemCategory, { color: themeColors.textSecondary }]}>📁 {cat ? cat.nombre : 'Sin categoría'}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 10 }}>
                        <Text style={[styles.itemStock, { color: item.stock_actual < 10 ? themeColors.danger : themeColors.success }]}>
                          {item.stock_actual} pzas
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity onPress={() => handleOpenEditModal(item)} style={styles.iconBtn}>
                            <Ionicons name="create-outline" size={18} color={themeColors.accent} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleSoftDelete(item.id, item.nombre_oficial)} style={styles.iconBtn}>
                            <Ionicons name="trash-outline" size={18} color={themeColors.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="cube-outline" size={48} color={themeColors.textSecondary} />
                    <Text style={{ color: themeColors.textSecondary, marginTop: 8 }}>No se encontraron productos.</Text>
                  </View>
                }
              />
            </View>
          )}

          {/* TAB 2: IMPORTAR CON IA */}
          {activeTab === 'ia-import' && (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={[styles.panel, { backgroundColor: themeColors.backgroundElement, borderColor: themeColors.border }]}>
                <Text style={[styles.panelTitle, { color: themeColors.accent }]}>Carga de Factura PDF mediante IA</Text>

                {stagingItems.length === 0 ? (
                  <View style={styles.uploadBox}>
                    {isAnalyzing ? (
                      <View style={{ alignItems: 'center', gap: 12 }}>
                        <ActivityIndicator size="large" color={themeColors.accent} />
                        <Text style={{ color: themeColors.text, fontWeight: '700' }}>Extrayendo metadatos y partidas con IA...</Text>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={handleSimulateOcr} style={{ alignItems: 'center' }}>
                        <Ionicons name="cloud-upload-outline" size={64} color={themeColors.textSecondary} />
                        <Text style={[styles.uploadText, { color: themeColors.text }]}>Arrastra aquí la Factura PDF</Text>
                        <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 4 }}>o presiona aquí para simular el escaneo con IA</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={{ gap: 16 }}>
                    {/* Metadatos */}
                    <View style={styles.stagingMetaRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.metaLabel, { color: themeColors.textSecondary }]}>Proveedor de Factura</Text>
                        <select
                          value={selectedProveedorId}
                          onChange={e => setSelectedProveedorId(e.target.value)}
                          style={{
                            ...webStyles.select,
                            backgroundColor: themeColors.background,
                            color: themeColors.text,
                            borderColor: themeColors.border
                          }}
                        >
                          <option value="">Seleccione Proveedor</option>
                          {proveedores.map(p => (
                            <option key={p.id} value={p.id}>{p.nombre}</option>
                          ))}
                        </select>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.metaLabel, { color: themeColors.textSecondary }]}>Folio de Factura</Text>
                        <TextInput
                          placeholder="Folio factura"
                          placeholderTextColor={themeColors.textSecondary}
                          value={folioFactura}
                          onChangeText={setFolioFactura}
                          style={[styles.inputField, { backgroundColor: themeColors.background, color: themeColors.text, borderColor: themeColors.border }]}
                        />
                      </View>
                    </View>

                    {/* Listado Partidas Staging */}
                    <Text style={{ fontSize: 14, fontWeight: '800', color: themeColors.text, marginTop: 8 }}>Productos Detectados (Borrador)</Text>
                    {stagingItems.map(item => (
                      <View key={item.id} style={[styles.stagingItemRow, { borderColor: themeColors.border }]}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={[styles.stagingItemName, { color: themeColors.text }]}>{item.nombreFactura}</Text>
                          <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>Cant: {item.cantidad}</Text>
                            <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>P.Unit: ${item.precioUnitario}</Text>
                          </View>
                        </View>

                        <View style={{ flex: 1, alignItems: 'flex-end', gap: 6 }}>
                          {item.esNuevoProducto ? (
                            <View style={{ gap: 4, width: '100%' }}>
                              <Text style={{ fontSize: 10, color: themeColors.warning, fontWeight: '700' }}>CREAR COMO NUEVO</Text>
                              <select
                                value={item.categoriaSeleccionadaId || ''}
                                onChange={e => handleUpdateStagingItem(item.id, { categoriaSeleccionadaId: e.target.value })}
                                style={{
                                  ...webStyles.select,
                                  backgroundColor: themeColors.background,
                                  color: themeColors.text,
                                  borderColor: themeColors.border,
                                  padding: 4,
                                  fontSize: 12
                                }}
                              >
                                {categorias.map(c => (
                                  <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                              </select>
                            </View>
                          ) : (
                            <select
                              value={item.productoIdSugerido || ''}
                              onChange={e => handleUpdateStagingItem(item.id, { productoIdSugerido: e.target.value })}
                              style={{
                                ...webStyles.select,
                                backgroundColor: themeColors.background,
                                color: themeColors.text,
                                borderColor: themeColors.border,
                                padding: 4,
                                fontSize: 12,
                                width: '100%'
                              }}
                            >
                              <option value="">-- Mapear Catálogo --</option>
                              {productos.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre_oficial}</option>
                              ))}
                            </select>
                          )}

                          <TouchableOpacity
                            onPress={() => handleUpdateStagingItem(item.id, { esNuevoProducto: !item.esNuevoProducto })}
                          >
                            <Text style={{ fontSize: 12, color: themeColors.accent, fontWeight: '700', textDecorationLine: 'underline' }}>
                              {item.esNuevoProducto ? 'Asociar Existente' : 'Marcar Nuevo'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                      <CustomButton title="Recomenzar" onPress={() => setStagingItems([])} variant="danger" style={{ height: 42 }} />
                      <CustomButton
                        title={isCommittingIA ? "Guardando..." : "Guardar en Catálogo"}
                        onPress={handleCommitAI}
                        variant="success"
                        style={{ height: 42 }}
                        loading={isCommittingIA}
                      />
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* TAB 3: CATEGORIAS */}
          {activeTab === 'categorias' && (
            <ScrollView contentContainerStyle={styles.scrollContent}>
              <View style={[styles.panel, { backgroundColor: themeColors.backgroundElement, borderColor: themeColors.border }]}>
                <Text style={[styles.panelTitle, { color: themeColors.accent }]}>Transferencia Masiva de Categorías</Text>
                <Text style={{ color: themeColors.textSecondary, fontSize: 13, marginBottom: 16 }}>
                  Mueve masivamente todos los productos activos de una categoría de origen a otra de destino en un solo paso.
                </Text>

                <View style={{ gap: 12, marginBottom: 20 }}>
                  <Text style={[styles.metaLabel, { color: themeColors.textSecondary }]}>Categoría Origen</Text>
                  <select
                    value={sourceCatId}
                    onChange={e => setSourceCatId(e.target.value)}
                    style={{
                      ...webStyles.select,
                      backgroundColor: themeColors.background,
                      color: themeColors.text,
                      borderColor: themeColors.border
                    }}
                  >
                    <option value="">Selecciona Origen</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>

                  <Text style={[styles.metaLabel, { color: themeColors.textSecondary }]}>Categoría Destino</Text>
                  <select
                    value={destCatId}
                    onChange={e => setDestCatId(e.target.value)}
                    style={{
                      ...webStyles.select,
                      backgroundColor: themeColors.background,
                      color: themeColors.text,
                      borderColor: themeColors.border
                    }}
                  >
                    <option value="">Selecciona Destino</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </View>

                <CustomButton
                  title={isMovingMassive ? "Transfiriendo..." : "Mover Productos Masivamente"}
                  onPress={handleBulkMove}
                  loading={isMovingMassive}
                  variant="primary"
                />
              </View>

              {/* Listado de categorías */}
              <View style={{ gap: 10, marginTop: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: themeColors.text }}>Categorías Registradas</Text>
                {categorias.map(c => {
                  const pCount = productos.filter(p => p.categoria_id === c.id).length;
                  return (
                    <View key={c.id} style={[styles.catRow, { backgroundColor: themeColors.backgroundElement, borderColor: themeColors.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.catName, { color: themeColors.text }]}>{c.nombre}</Text>
                        {!!c.descripcion && <Text style={{ color: themeColors.textSecondary, fontSize: 11 }}>{c.descripcion}</Text>}
                      </View>
                      <View style={[styles.catBadge, { backgroundColor: themeColors.accent + '15' }]}>
                        <Text style={{ color: themeColors.accent, fontSize: 12, fontWeight: '700' }}>{pCount} pzas</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      )}

      {/* ========== MODAL CRUD MANUAL ========== */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: themeColors.backgroundElement }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto Manual'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 16 }}>
              <CustomInput
                label="SKU Interno / Código"
                placeholder="Ej. SOL-REN-640W"
                value={formSku}
                onChangeText={setFormSku}
              />
              <CustomInput
                label="Nombre Oficial"
                placeholder="Ej. Panel Solar Renesola N-Type..."
                value={formNombre}
                onChangeText={setFormNombre}
              />

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: themeColors.textSecondary }}>Categoría</Text>
                <select
                  value={formCategoriaId}
                  onChange={e => setFormCategoriaId(e.target.value)}
                  style={{
                    ...webStyles.select,
                    backgroundColor: themeColors.background,
                    color: themeColors.text,
                    borderColor: themeColors.border
                  }}
                >
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </View>

              <CustomInput
                label="Stock Inicial"
                keyboardType="numeric"
                value={formStock.toString()}
                onChangeText={v => setFormStock(Number(v) || 0)}
              />

              <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                <CustomButton title="Cancelar" onPress={() => setIsModalOpen(false)} variant="danger" style={{ height: 42 }} />
                <CustomButton
                  title={isSavingProduct ? "Guardando..." : "Guardar Producto"}
                  onPress={handleSaveProduct}
                  variant="primary"
                  style={{ height: 42 }}
                  loading={isSavingProduct}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Estilos nativos estilizados
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  backBtn: {
    padding: Spacing.one,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterSection: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    gap: Spacing.two,
  },
  searchInput: {
    flex: 2,
    height: 44,
    borderWidth: 1,
    borderRadius: BorderRadius.medium,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
  },
  pickerContainer: {
    flex: 1.2,
    height: 44,
  },
  floatingAddBtn: {
    position: 'absolute',
    bottom: Spacing.four,
    right: Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 99,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.seven,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    marginBottom: Spacing.two,
  },
  itemSku: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  itemCategory: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemStock: {
    fontSize: 15,
    fontWeight: '800',
  },
  iconBtn: {
    padding: 6,
    borderRadius: BorderRadius.small,
    backgroundColor: '#00000008',
  },
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.seven,
  },
  panel: {
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  uploadBox: {
    height: 160,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#aaa',
    borderRadius: BorderRadius.medium,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00000005',
    padding: Spacing.three,
  },
  uploadText: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: Spacing.one,
  },
  stagingMetaRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  inputField: {
    height: 40,
    borderWidth: 1,
    borderRadius: BorderRadius.small,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
  },
  stagingItemRow: {
    borderWidth: 1,
    borderRadius: BorderRadius.small,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  stagingItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: BorderRadius.medium,
    borderWidth: 1,
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
  },
  catBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: BorderRadius.pill,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 450,
    borderRadius: BorderRadius.large,
    padding: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
});

// Estilos web puros para consistencia de elementos select HTML5
const webStyles = {
  select: {
    width: '100%',
    height: 44,
    padding: '0 12px',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    fontSize: 14,
    cursor: 'pointer',
    outline: 'none',
  },
};
