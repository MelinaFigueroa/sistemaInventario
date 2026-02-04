
/**
 * BUENA PRÁCTICA: Centralizar configuración y constantes.
 */
const AFIP_CONFIG = {
    WSAA_URL: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    WSFE_URL: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
    // Asegurate de que este CUIT coincida con el de tu certificado de homologación
    DEFAULT_CUIT: "27344838890",
};

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
};

Deno.serve(async (req) => {
    // 1. Manejo de CORS (Pre-flight request)
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    console.log(`[${new Date().toISOString()}] Solicitud recibida: ${req.method}`);

    try {
        // 2. Validación de entrada (Body)
        // BUENA PRÁCTICA: No asumir que el JSON viene bien formado
        let body;
        try {
            body = await req.json();
        } catch (e) {
            throw new Error("El cuerpo de la solicitud no es un JSON válido.");
        }

        const { pedidoId, total, cliente } = body;

        if (!pedidoId || !total) {
            throw new Error("Faltan datos obligatorios: 'pedidoId' y 'total'.");
        }

        // 3. Verificación de Secrets
        // BUENA PRÁCTICA: Validar variables de entorno antes de operar
        const PRIVATE_KEY = Deno.env.get("AFIP_KEY");
        const CERTIFICATE = Deno.env.get("AFIP_CERT");

        if (!PRIVATE_KEY || !CERTIFICATE) {
            console.error("Error: AFIP_KEY o AFIP_CERT no están configurados en Supabase.");
            throw new Error("Error interno: Configuración de AFIP incompleta.");
        }

        /**
         * 4. Lógica de Facturación (Simulada por ahora)
         * Nota: Para producción, aquí se implementa la firma CMS (PKCS#7).
         */
        console.log(`Procesando factura para Pedido: ${pedidoId}, Total: $${total}`);

        // Simulamos un delay de red para que el frontend vea el estado de carga
        await new Promise(resolve => setTimeout(resolve, 800));

        const responseData = {
            success: true,
            cae: "73033527875222",
            caeFchVto: "20260215",
            puntoVenta: 1,
            nroComprobante: Math.floor(Math.random() * 1000) + 1,
            resultado: "A",
            mensaje: "Comprobante autorizado exitosamente (Modo Homologación)"
        };

        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: CORS_HEADERS
        });

    } catch (error) {
        // 5. Manejo de errores detallado
        // BUENA PRÁCTICA: Loguear el error real en el servidor, pero devolver algo limpio al cliente
        console.error(`[ERROR AFIP]: ${error.message}`);

        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || "Error inesperado al procesar con AFIP"
            }),
            {
                status: error.message.includes("Faltan datos") ? 400 : 500,
                headers: CORS_HEADERS
            }
        );
    }
});