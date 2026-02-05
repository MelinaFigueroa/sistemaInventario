// js/clientes.js - Gestión de base de datos de clientes

function abrirModalCliente() {
    document.getElementById("cli-nombre").value = "";
    document.getElementById("cli-cuit").value = "";
    document.getElementById("cli-direccion").value = "";
    document.getElementById("modal-cliente").classList.remove("hidden");
}

function cerrarModalCliente() {
    document.getElementById("modal-cliente").classList.add("hidden");
}

async function guardarClienteSupabase() {
    const nombre = document.getElementById("cli-nombre").value;
    const cuit = document.getElementById("cli-cuit").value;
    const direccion = document.getElementById("cli-direccion").value;

    if (!nombre || !cuit) {
        Notificar.error("DATOS INCOMPLETOS", "El nombre y el CUIT son obligatorios.");
        return;
    }

    try {
        const { error } = await _supabase
            .from("clientes")
            .insert([{
                nombre: nombre,
                cuit: cuit,
                direccion: direccion
            }]);

        if (error) throw error;

        Notificar.exito("CLIENTE REGISTRADO", `<b>${nombre}</b> ha sido añadido a la base de datos.`);
        cerrarModalCliente();
        if (typeof renderClientes === 'function') renderClientes();

    } catch (e) {
        console.error("Error guardando cliente:", e);
        Notificar.error("ERROR", "No se pudo guardar el cliente. Verificá si la tabla 'clientes' existe.");
    }
}
