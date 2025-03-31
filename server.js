require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Middleware de autenticação
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token inválido' });
    }
};

// Rotas de autenticação
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

    if (error || !user || user.password !== password) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const token = jwt.sign(
        { id: user.id, email: user.email, is_admin: user.is_admin },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// Rotas protegidas
app.get('/addresses', authenticate, async (req, res) => {
    try {
        let query = supabase.from('addresses').select('*');

        // Filtros opcionais
        if (req.query.city) {
            query = query.eq('city', req.query.city);
        }
        if (req.query.status === 'assigned') {
            query = query.not('assigned_to', 'is', null).is('completed_at', null);
        } else if (req.query.status === 'completed') {
            query = query.not('completed_at', 'is', null);
        } else if (req.query.status === 'pending') {
            query = query.is('assigned_to', null);
        }

        // Paginação
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const startIndex = (page - 1) * limit;

        const { data, error, count } = await query
            .range(startIndex, startIndex + limit - 1)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ data, total: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/addresses/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    try {
        const updates = {
            assigned_to: status === 'assigned' ? userId : null,
            assigned_at: status === 'assigned' ? new Date() : null,
            completed_at: status === 'completed' ? new Date() : null
        };

        const { data, error } = await supabase
            .from('addresses')
            .update(updates)
            .eq('id', id);

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Rotas de estatísticas
app.get('/stats', authenticate, async (req, res) => {
    try {
        const { count: total } = await supabase
            .from('addresses')
            .select('*', { count: 'exact', head: true });

        const { data: byCity } = await supabase
            .from('addresses')
            .select('city, count')
            .group('city');

        const { data: statusCounts } = await supabase
            .from('addresses')
            .select(`
                count,
                status:case(
                    completed_at.not.is.null, 'completed',
                    assigned_to.not.is.null, 'assigned',
                    'pending'
                )
            `)
            .group('status');

        res.json({
            total,
            byCity,
            statusCounts: statusCounts.reduce((acc, curr) => {
                acc[curr.status] = curr.count;
                return acc;
            }, {})
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});