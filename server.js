require("dotenv").config();
const express = require("express");
const { createClient } = require('@supabase/supabase-js');
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
app.use(cors());

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Autenticação
const verifyToken = (req, res, next) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(403).json({ error: "Token não fornecido" });
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token inválido" });
        req.user = decoded;
        next();
    });
};

// Rotas
app.post("/register", async (req, res) => {
    const { name, email, password, is_admin } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
        .from('users')
        .insert([{ name, email, password: hashedPassword, is_admin }]);
    if (error) res.status(500).json(error);
    else res.json({ success: true });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email);
    if (error || users.length === 0) return res.status(401).json({ error: "Usuário não encontrado" });
    const user = users[0];
    if (!(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: "Senha incorreta" });
    }
    const token = jwt.sign({ id: user.id, is_admin: user.is_admin }, process.env.JWT_SECRET, { expiresIn: "24h" });
    res.json({ token, user });
});

app.get("/addresses", verifyToken, async (req, res) => {
    if (req.user.is_admin) {
        const { data, error } = await supabase.from('addresses').select('*');
        if (error) res.status(500).json(error);
        else res.json(data);
    } else {
        const { data, error } = await supabase
            .from('addresses')
            .select('*')
            .eq('assigned_to', req.user.id);
        if (error) res.status(500).json(error);
        else res.json(data);
    }
});

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));

app.get("/test", (req, res) => {
    res.json({ status: "Server is running!" });
});
