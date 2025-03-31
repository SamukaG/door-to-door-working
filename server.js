require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// Rota pública para obter endereços
app.get('/public/addresses', async (req, res) => {
    try {
        const { city, min_flats } = req.query;
        
        let query = supabase
            .from('addresses')
            .select(`
                id,
                street,
                house_number,
                city,
                postcode,
                lat,
                lng,
                flats,
                levels,
                created_at
            `)
            .order('created_at', { ascending: false });

        // Aplicar filtros
        if (city) query = query.eq('city', city);
        if (min_flats) query = query.gte('flats', min_flats);

        const { data, error } = await query;

        if (error) throw error;
        
        res.json(data || []);

    } catch (error) {
        console.error('Error fetching addresses:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Rota de saúde do servidor
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Public endpoints:`);
    console.log(`- GET /public/addresses`);
    console.log(`- GET /health`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
});
