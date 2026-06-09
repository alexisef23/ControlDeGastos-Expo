import { documentDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Gasto } from '../services/supabase';

export const ReportGenerator = {
  /**
   * Genera un reporte PDF de los gastos y lo comparte mediante la hoja nativa
   */
  async exportToPDF(gastos: Gasto[], title: string = 'Reporte de Control de Gastos'): Promise<void> {
    if (gastos.length === 0) {
      throw new Error('No hay gastos para exportar.');
    }

    const totalMonto = gastos.reduce((sum, g) => sum + Number(g.monto), 0);
    const approvedCount = gastos.filter((g) => g.status === 'APPROVED').length;
    const pendingCount = gastos.filter((g) => g.status === 'PENDING').length;

    // Generar tabla HTML
    let tableRows = '';
    gastos.forEach((g) => {
      const fecha = g.fecha_comprobante || g.created_at?.split('T')[0] || '';
      const montoFormatted = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(Number(g.monto));

      let badgeColor = '#FFC107'; // PENDING -> Yellow
      if (g.status === 'APPROVED') badgeColor = '#4CAF50';
      if (g.status === 'REJECTED') badgeColor = '#F44336';
      if (g.status === 'ACTION_REQUIRED') badgeColor = '#2196F3';

      tableRows += `
        <tr>
          <td>${fecha}</td>
          <td>${g.empleado_nombre || 'Desconocido'}</td>
          <td>${g.proveedor || 'N/A'}</td>
          <td>${g.categoria || 'N/A'} - ${g.subcategoria || ''}</td>
          <td>${g.metodo_pago}</td>
          <td><span class="status-badge" style="background-color: ${badgeColor};">${g.status}</span></td>
          <td style="text-align: right; font-weight: bold;">${montoFormatted}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            margin: 0;
            padding: 24px;
          }
          .header-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #0d1b2a;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .title {
            color: #0d1b2a;
            font-size: 24px;
            font-weight: bold;
            margin: 0;
          }
          .subtitle {
            color: #777;
            font-size: 12px;
            margin-top: 5px;
          }
          .summary-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 25px;
            gap: 15px;
          }
          .summary-card {
            flex: 1;
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 12px;
            text-align: center;
          }
          .summary-card .value {
            font-size: 18px;
            font-weight: bold;
            color: #0d1b2a;
            margin-top: 5px;
          }
          .summary-card .label {
            font-size: 10px;
            text-transform: uppercase;
            color: #888;
            letter-spacing: 0.5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 11px;
          }
          th {
            background-color: #0d1b2a;
            color: white;
            text-align: left;
            padding: 10px 8px;
            font-weight: 600;
          }
          td {
            padding: 10px 8px;
            border-bottom: 1px solid #e9ecef;
          }
          tr:nth-child(even) {
            background-color: #fcfcfd;
          }
          .status-badge {
            color: white;
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 8px;
            font-weight: bold;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #aaa;
            border-top: 1px solid #eee;
            padding-top: 15px;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          <div>
            <h1 class="title">${title}</h1>
            <p class="subtitle">Generado el: ${new Date().toLocaleString()}</p>
          </div>
          <div style="font-weight: bold; color: #1b4965; font-size: 18px;">INTTEC</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="label">Total Gastos</div>
            <div class="value">${gastos.length}</div>
          </div>
          <div class="summary-card">
            <div class="label">Aprobados</div>
            <div class="value" style="color: #4CAF50;">${approvedCount}</div>
          </div>
          <div class="summary-card">
            <div class="label">Pendientes</div>
            <div class="value" style="color: #FFC107;">${pendingCount}</div>
          </div>
          <div class="summary-card">
            <div class="label">Monto Total</div>
            <div class="value" style="color: #1b4965;">${new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
            }).format(totalMonto)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 12%">Fecha</th>
              <th style="width: 20%">Empleado</th>
              <th style="width: 18%">Proveedor</th>
              <th style="width: 20%">Categoría</th>
              <th style="width: 12%">Pago</th>
              <th style="width: 8%">Estado</th>
              <th style="width: 10%; text-align: right;">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="footer">
          Documento Confidencial - Control de Gastos INTTEC - Sistema Automatizado
        </div>
      </body>
      </html>
    `;

    try {
      // Generar archivo PDF temporal
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      
      // Compartir nativamente
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Exportar Reporte PDF',
          UTI: 'com.adobe.pdf',
        });
      } else {
        throw new Error('La función de compartir no está disponible en este dispositivo.');
      }
    } catch (error: any) {
      console.error('Error generating PDF report:', error);
      throw new Error(error.message || 'Error al generar el reporte PDF.');
    }
  },

  /**
   * Genera un archivo CSV de los gastos y lo comparte mediante la hoja nativa
   */
  async exportToCSV(gastos: Gasto[], fileName: string = 'reporte_gastos.csv'): Promise<void> {
    if (gastos.length === 0) {
      throw new Error('No hay gastos para exportar.');
    }

    // Encabezados
    let csvContent = '\uFEFF'; // BOM para que Excel abra UTF-8 correctamente
    csvContent += 'ID,Fecha,Empleado Nombre,Monto,Categoria,Subcategoria,Proveedor,Cliente,Sucursal,Metodo Pago,Tipo Tarjeta,Status,Justificacion\n';

    // Rellenar filas
    gastos.forEach((g) => {
      const fecha = g.fecha_comprobante || g.created_at?.split('T')[0] || '';
      const escape = (text?: string | null) => {
        if (!text) return '';
        const cleaned = text.replace(/"/g, '""');
        return `"${cleaned}"`;
      };

      const row = [
        g.id,
        fecha,
        escape(g.empleado_nombre),
        g.monto,
        escape(g.categoria),
        escape(g.subcategoria),
        escape(g.proveedor),
        escape(g.cliente),
        escape(g.sucursal),
        g.metodo_pago,
        escape(g.tipo_tarjeta),
        g.status,
        escape(g.justificacion),
      ].join(',');

      csvContent += row + '\n';
    });

    try {
      // Guardar el archivo en el sistema de archivos local de Expo
      const fileUri = `${documentDirectory}${fileName}`;
      await writeAsStringAsync(fileUri, csvContent, {
        encoding: EncodingType.UTF8,
      });

      // Compartir nativamente
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Exportar Reporte CSV',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        throw new Error('La función de compartir no está disponible en este dispositivo.');
      }
    } catch (error: any) {
      console.error('Error generating CSV report:', error);
      throw new Error(error.message || 'Error al generar el reporte CSV.');
    }
  },
};
