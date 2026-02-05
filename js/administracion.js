// js/administracion.js - Gestión de Saldos y Finanzas

/**
 * Recalcula el saldo de todos los clientes basándose en facturas y pagos aprobados.
 * Si un cliente debe plata, lo marca como 'deudor'.
 */
async function actualizarSaldosDeudores() {
    try {
        console.log("💳 Iniciando auditoría de saldos...");

        // 1. Obtener todos los clientes
        const { data: clientes } = await _supabase.from("clientes").select("id, nombre");

        for (const cliente of clientes) {
            // 2. Sumar total de facturas (Deuda)
            const { data: facturas } = await _supabase
                .from("facturas")
                .select("total_final")
                .eq("cliente_nombre", cliente.nombre); // O por ID si se actualiza la tabla

            const totalDeuda = facturas?.reduce((acc, f) => acc + (f.total_final || 0), 0) || 0;

            // 3. Sumar total de pagos (Crédito) - Solo pagos con estado 'aprobado'
            const { data: pagos } = await _supabase
                .from("pagos")
                .select("monto")
                .eq("cliente_id", cliente.id)
                .eq("estado", "aprobado");

            const totalPagado = pagos?.reduce((acc, p) => acc + (p.monto || 0), 0) || 0;

            const saldo = totalDeuda - totalPagado;

            // 4. Actualizar estado del cliente (Margen de tolerancia $100)
            const nuevoEstado = saldo > 100 ? 'deudor' : 'activo';

            await _supabase
                .from("clientes")
                .update({ estado: nuevoEstado })
                .eq("id", cliente.id);

            console.log(`✅ Cliente: ${cliente.nombre} | Saldo: $${saldo} | Estado: ${nuevoEstado}`);
        }

        Notificar.toast("Auditoria de saldos finalizada", "success");

    } catch (error) {
        console.error("Error en auditoría:", error);
    }
}
