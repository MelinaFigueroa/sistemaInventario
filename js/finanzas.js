// js/finanzas.js - Gestión de Cobranzas, Auditoría de Saldos y Storage

/**
 * REGISTRO DE PAGOS CON SUBIDA DE COMPROBANTE AL STORAGE
 * @param {Object} pagoData - Datos del pago (cliente_id, monto, metodo_pago, notas)
 * @param {File} archivo - El archivo de imagen (comprobante)
 */
async function registrarPago(pagoData, archivo) {
    try {
        Swal.fire({
            title: 'Registrando Pago...',
            text: 'Subiendo comprobante y guardando datos',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        let urlComprobante = null;

        // 1. Subida al Storage si hay archivo
        if (archivo) {
            const fileExt = archivo.name.split('.').pop();
            const fileName = `${Date.now()}_${pagoData.cliente_id}.${fileExt}`;
            const filePath = `comprobantes/${fileName}`;

            const { data: storageData, error: storageError } = await _supabase.storage
                .from('comprobantes')
                .upload(filePath, archivo);

            if (storageError) throw new Error("Error subiendo comprobante: " + storageError.message);

            // Obtener la URL pública
            const { data: { publicUrl } } = _supabase.storage
                .from('comprobantes')
                .getPublicUrl(filePath);

            urlComprobante = publicUrl;
        }

        // 2. Insertar en la tabla 'pagos'
        const { error: insertError } = await _supabase.from('pagos').insert([{
            cliente_id: pagoData.cliente_id,
            monto: pagoData.monto,
            metodo_pago: pagoData.metodo_pago,
            comprobante_url: urlComprobante,
            estado: 'pendiente', // Siempre entra como pendiente para revisión admin
            notas: pagoData.notas,
            usuario_carga: USUARIO_ACTUAL
        }]);

        if (insertError) throw insertError;

        Swal.close();
        await Swal.fire({
            title: '¡PAGO REGISTRADO!',
            text: 'El pago ha sido cargado y está pendiente de aprobación por Administración.',
            icon: 'success',
            confirmButtonColor: '#4f46e5'
        });

        if (typeof loadPage === 'function') loadPage('inicio.html');

    } catch (err) {
        console.error("Error en registrarPago:", err);
        Swal.close();
        Notificar.error("ERROR", err.message);
    }
}

/**
 * APROBACIÓN DE PAGO (Solo para Admin / Administracion)
 */
async function aprobarPago(pagoId) {
    try {
        const { data, error } = await _supabase
            .from('pagos')
            .update({ estado: 'aprobado', fecha_aprobacion: new Date().toISOString() })
            .eq('id', pagoId)
            .select('cliente_id')
            .single();

        if (error) throw error;

        Notificar.toast("Pago aprobado con éxito", "success");

        // Al aprobar un pago, recalculamos automáticamente el saldo del cliente
        if (data.cliente_id) {
            await actualizarSaldoCliente(data.cliente_id);
        }

        // Refrescar vista si existe la función
        if (typeof renderPagosPendientes === 'function') renderPagosPendientes();
        if (typeof actualizarDashboard === 'function') await actualizarDashboard();

    } catch (err) {
        console.error("Error en aprobarPago:", err);
        Notificar.error("ERROR", "No se pudo aprobar el pago.");
    }
}

/**
 * RECALCULA EL SALDO DE UN CLIENTE ESPECÍFICO
 */
async function actualizarSaldoCliente(clienteId) {
    try {
        // 1. Obtener nombre del cliente (para buscar facturas que usan nombre por ahora)
        const { data: cliente } = await _supabase.from('clientes').select('nombre').eq('id', clienteId).single();
        if (!cliente) return;

        // 2. Sumar Facturas
        const { data: facturas } = await _supabase.from('facturas').select('total_final').eq('cliente_nombre', cliente.nombre);
        const totalVentas = facturas?.reduce((acc, f) => acc + (f.total_final || 0), 0) || 0;

        // 3. Sumar Pagos Aprobados
        const { data: pagos } = await _supabase.from('pagos').select('monto').eq('cliente_id', clienteId).eq('estado', 'aprobado');
        const totalPagos = pagos?.reduce((acc, p) => acc + (p.monto || 0), 0) || 0;

        const saldo = totalVentas - totalPagos;

        // 4. Actualizar estado (Umbral de $500 para considerar deuda activa)
        const nuevoEstado = saldo > 500 ? 'deudor' : 'activo';

        await _supabase.from('clientes').update({
            estado: nuevoEstado,
            saldo_pendiente: saldo // Asumiendo que existe el campo, si no, solo actualiza estado
        }).eq('id', clienteId);

        console.log(`Balance Cliente ${cliente.nombre}: $${saldo} (${nuevoEstado})`);
    } catch (err) {
        console.error("Error actualizando saldo:", err);
    }
}

/**
 * AUDITORÍA GLOBAL DE SALDOS - Recorre todos los clientes
 * Se recomienda correr esto al iniciar el Dashboard de Admin
 */
async function ejecutarAuditoriaGlobalSaldos() {
    try {
        console.log("💳 Iniciando Auditoría Global de Saldos...");
        const { data: clientes } = await _supabase.from('clientes').select('id');

        for (const c of clientes) {
            await actualizarSaldoCliente(c.id);
        }

        console.log("✅ Auditoría completada.");
    } catch (err) {
        console.error("Error auditoría global:", err);
    }
}

/**
 * HISTORIAL DE CUENTA CORRIENTE: Cronológico con Saldos Parciales
 */
async function obtenerResumenCuentaCorriente(clienteId) {
    try {
        const { data: cliente } = await _supabase.from('clientes').select('nombre').eq('id', clienteId).single();
        if (!cliente) return [];

        // Traer Facturas y Pagos Aprobados
        const { data: facturas } = await _supabase.from('facturas').select('*').eq('cliente_nombre', cliente.nombre);
        const { data: pagos } = await _supabase.from('pagos').select('*').eq('cliente_id', clienteId).eq('estado', 'aprobado');

        // Unificar en una lista cronológica
        let movimientos = [
            ...facturas.map(f => ({ fecha: f.created_at, desc: `Factura ${f.nro_comprobante || '---'}`, debe: f.total_final, haber: 0, tipo: 'FACTURA' })),
            ...pagos.map(p => ({ fecha: p.created_at, desc: `Pago (${p.metodo_pago})`, debe: 0, haber: p.monto, tipo: 'PAGO' }))
        ];

        // Ordenar por fecha
        movimientos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        // Calcular saldos parciales
        let saldoAcumulado = 0;
        return movimientos.map(m => {
            saldoAcumulado += (m.debe - m.haber);
            return { ...m, saldo: saldoAcumulado };
        });
    } catch (err) {
        console.error(err);
        return [];
    }
}

/**
 * IMPORTADOR DE MOVIMIENTOS BANCARIOS (Conciliación por Monto)
 */
async function procesarCSVMovimientosBancarios(csvText) {
    try {
        const lineas = csvText.split('\n').filter(l => l.trim().length > 0);
        let conciliados = 0;

        for (const linea of lineas) {
            // Ejemplo CSV: Fecha,Descripción,Monto
            const campos = linea.split(',');
            const montoCSV = Math.abs(parseFloat(campos[2]));

            if (isNaN(montoCSV)) continue;

            // Buscar pagos pendientes con ese monto exacto
            const { data: pagosMatch } = await _supabase
                .from('pagos')
                .select('id, cliente_id')
                .eq('estado', 'pendiente')
                .eq('monto', montoCSV)
                .limit(1);

            if (pagosMatch && pagosMatch.length > 0) {
                await aprobarPago(pagosMatch[0].id);
                conciliados++;
            }
        }

        Notificar.exito("CONCILIACIÓN COMPLETADA", `Se aprobaron ${conciliados} pagos automáticamente.`);
        return conciliados;
    } catch (err) {
        console.error(err);
        Notificar.error("ERROR CSV", "No se pudo procesar el extracto bancario.");
    }
}

/**
 * EXPORTACIÓN LIBRO IVA VENTAS (CSV para Contador)
 */
async function exportarLibroIVAVentas(mes, anio) {
    try {
        const fechaDesde = new Date(anio, mes - 1, 1).toISOString();
        const fechaHasta = new Date(anio, mes, 0, 23, 59, 59).toISOString();

        const { data: facturas } = await _supabase
            .from('facturas')
            .select('*')
            .gte('created_at', fechaDesde)
            .lte('created_at', fechaHasta)
            .order('created_at');

        if (!facturas || facturas.length === 0) {
            Notificar.info("SIN DATOS", "No hay ventas registradas en el periodo seleccionado.");
            return;
        }

        let csv = "Fecha,Comprobante,Cliente,CUIT,Neto,IVA,Total\n";
        facturas.forEach(f => {
            const fecha = new Date(f.created_at).toLocaleDateString('es-AR');
            csv += `${fecha},${f.nro_comprobante || '---'},${f.cliente_nombre},${f.cliente_cuit || '---'},${f.total_neto},${f.iva},${f.total_final}\n`;
        });

        // Descarga del archivo
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `LibroIVA_Ventas_${mes}_${anio}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (err) {
        console.error(err);
        Notificar.error("ERROR EXPORTACIÓN", "No se pudo generar el reporte.");
    }
}

/**
 * UI: VENTANA DE CUENTA CORRIENTE
 */
async function abrirCuentaCorriente(clienteId) {
    Swal.fire({
        title: 'Cargando Historial...',
        didOpen: () => { Swal.showLoading(); }
    });

    const movimientos = await obtenerResumenCuentaCorriente(clienteId);

    if (movimientos.length === 0) {
        Swal.fire('SIN MOVIMIENTOS', 'Este cliente no tiene facturas ni pagos registrados.', 'info');
        return;
    }

    const { data: cliente } = await _supabase.from('clientes').select('nombre').eq('id', clienteId).single();

    Swal.fire({
        title: `CUENTA CORRIENTE: ${cliente.nombre}`,
        width: '900px',
        html: `
            <div class="overflow-x-auto mt-4">
                <table class="w-full text-left border-collapse text-[10px] font-bold uppercase italic">
                    <thead>
                        <tr class="bg-slate-100 text-slate-400">
                            <th class="p-3">Fecha</th>
                            <th class="p-3">Descripción</th>
                            <th class="p-3 text-rose-500">Debe (+)</th>
                            <th class="p-3 text-emerald-500">Haber (-)</th>
                            <th class="p-3 bg-indigo-50 text-indigo-700">Saldo</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${movimientos.map(m => `
                            <tr>
                                <td class="p-3 text-slate-400">${new Date(m.fecha).toLocaleDateString()}</td>
                                <td class="p-3 text-slate-700">${m.desc}</td>
                                <td class="p-3 text-rose-600">${m.debe > 0 ? formatearMoneda(m.debe) : '-'}</td>
                                <td class="p-3 text-emerald-600">${m.haber > 0 ? formatearMoneda(m.haber) : '-'}</td>
                                <td class="p-3 font-black ${m.saldo > 0 ? 'text-rose-700' : 'text-emerald-700'}">${formatearMoneda(m.saldo)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#4f46e5'
    });
}

/**
 * PREPARAR FORMULARIO DE COBRANZAS
 * Carga la lista de clientes en el select
 */
/**
 * PREPARAR FORMULARIO DE COBRANZAS
 * Carga la lista de clientes en el select
 */
async function prepararCobranzas() {
    console.log("💳 Preparando módulo de cobranzas...");
    try {
        const select = document.getElementById('cob-cliente-select');
        if (!select) {
            console.warn("⚠️ Elemento 'cob-cliente-select' no encontrado en el DOM.");
            return;
        }

        // Mostrar estado de carga
        select.innerHTML = '<option value="">Cargando clientes de Supabase...</option>';

        const { data: clientes, error } = await _supabase
            .from('clientes')
            .select('id, nombre')
            .order('nombre');

        if (error) {
            console.error("❌ Error Supabase al cargar clientes:", error);
            throw error;
        }

        if (!clientes || clientes.length === 0) {
            select.innerHTML = '<option value="">Sin clientes registrados</option>';
            return;
        }

        console.log(`✅ ${clientes.length} clientes cargados para cobranza.`);
        select.innerHTML = '<option value="">Seleccionar Cliente...</option>' +
            clientes.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    } catch (e) {
        console.error("❌ Error crítico preparando cobranzas:", e);
        const select = document.getElementById('cob-cliente-select');
        if (select) select.innerHTML = '<option value="">Error al cargar clientes</option>';
        Notificar.error("ERROR DE CONEXIÓN", "No se pudieron obtener los clientes. Verifica tu conexión.");
    }
}

/**
 * UTILS PARA UI DE COBRANZAS (Previews)
 */
function mostrarPreviewCobranza(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('img-preview');
            const container = document.getElementById('preview-container');
            if (preview) preview.src = e.target.result;
            if (container) container.classList.remove('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function resetPreviewCobranza() {
    const fileInput = document.getElementById('cob-foto');
    const container = document.getElementById('preview-container');
    if (fileInput) fileInput.value = '';
    if (container) container.classList.add('hidden');
}

/**
 * GESTIÓN DE ENVÍO DE PAGO (Desde el formulario de cobranzas.html)
 */
async function prepararEnvioPago(e) {
    if (e) e.preventDefault();
    console.log("📤 Iniciando proceso de envío de pago...");

    try {
        const clienteId = document.getElementById('cob-cliente-select')?.value;
        const monto = parseFloat(document.getElementById('cob-monto')?.value);
        const metodo = document.getElementById('cob-metodo')?.value;
        const notas = document.getElementById('cob-observaciones')?.value;
        const fileInput = document.getElementById('cob-foto');
        const archivo = fileInput?.files[0];

        if (!clienteId) {
            Swal.fire('¡FALTA CLIENTE!', 'Seleccioná a qué cliente le estás cargando el pago.', 'warning');
            return;
        }

        if (isNaN(monto) || monto <= 0) {
            Swal.fire('¡MONTO INVÁLIDO!', 'Ingresá un importe válido mayor a 0.', 'warning');
            return;
        }

        if (!archivo) {
            Swal.fire('¡FALTA COMPROBANTE!', 'Tenés que subir la foto de la transferencia o recibo.', 'error');
            return;
        }

        const pagoData = {
            cliente_id: clienteId,
            monto: monto,
            metodo_pago: metodo,
            notas: notas
        };

        await registrarPago(pagoData, archivo);

    } catch (err) {
        console.error("❌ Error en prepararEnvioPago:", err);
        Notificar.error("ERROR", "No se pudo procesar el formulario.");
    }
}

