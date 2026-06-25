const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

// ============================================
// API ALUMNOS
// ============================================

// 1. POST - Registrar un nuevo alumno
// 1. POST - Registrar un nuevo alumno
app.post('/api/alumnos/registro', async (req, res) => {
  try {
    const { nombre, apaterno, amaterno, numero_control, password } = req.body;
    
    if (!nombre || !apaterno || !amaterno || !numero_control || !password) {
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos: nombre, apaterno, amaterno, numero_control, password' 
      });
    }
    
    // ✅ Validación: Número de control debe tener exactamente 10 dígitos
    if (!/^\d{10}$/.test(numero_control)) {
      return res.status(400).json({ 
        error: 'El número de control debe tener exactamente 10 dígitos numéricos' 
      });
    }
    
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    const nuevo = await pool.query(
      `INSERT INTO alumnos (nombre, apaterno, amaterno, numero_control, password, activo) 
       VALUES ($1, $2, $3, $4, $5, true) 
       RETURNING id, nombre, apaterno, amaterno, numero_control`,
      [nombre, apaterno, amaterno, numero_control, passwordHash]
    );
    
    res.status(201).json({ 
      mensaje: 'Alumno registrado con éxito',
      alumno: nuevo.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El número de control ya está registrado' });
    }
    res.status(500).json({ error: err.message });
  }
});

// 2. POST - Login de alumno
app.post('/api/alumnos/login', async (req, res) => {
  try {
    const { numero_control, password } = req.body;
    
    if (!numero_control || !password) {
      return res.status(400).json({ error: 'Número de control y contraseña son requeridos' });
    }
    
    const resultado = await pool.query(
      'SELECT * FROM alumnos WHERE numero_control = $1',
      [numero_control]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    
    const alumno = resultado.rows[0];
    const passwordValido = await bcrypt.compare(password, alumno.password);
    
    if (!passwordValido) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    
    res.json({
      mensaje: 'Login exitoso',
      alumno: {
        id: alumno.id,
        nombre: alumno.nombre,
        apaterno: alumno.apaterno,
        amaterno: alumno.amaterno,
        numero_control: alumno.numero_control
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET - Obtener TODOS los alumnos (incluyendo inactivos) - solo para admin
// ✅ IMPORTANTE: Esta ruta DEBE IR ANTES de /api/alumnos/:id
app.get('/api/alumnos/todos', async (req, res) => {
    try {
        const resultado = await pool.query(
            'SELECT id, nombre, apaterno, amaterno, numero_control, activo FROM alumnos ORDER BY apaterno ASC, nombre ASC'
        );
        res.json(resultado.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. GET - Obtener un alumno por ID
app.get('/api/alumnos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      `SELECT id, nombre, apaterno, amaterno, numero_control, activo
       FROM alumnos WHERE id = $1`,
      [id]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. GET - Obtener todos los alumnos activos (solo para admin)
app.get('/api/alumnos', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, apaterno, amaterno, numero_control FROM alumnos WHERE activo = true ORDER BY apaterno ASC, nombre ASC'
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. DELETE - Soft Delete (desactivar alumno)
app.delete('/api/alumnos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query('SELECT * FROM alumnos WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Alumno no encontrado' });
        }
        if (!check.rows[0].activo) {
            return res.status(400).json({ error: 'El alumno ya está inactivo' });
        }
        const resultado = await pool.query(
            'UPDATE alumnos SET activo = false WHERE id = $1 RETURNING id, nombre, apaterno, amaterno, numero_control, activo',
            [id]
        );
        res.json({
            mensaje: `Alumno "${resultado.rows[0].nombre} ${resultado.rows[0].apaterno}" desactivado correctamente`,
            alumno: resultado.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 7. PUT - Reactivar alumno
app.put('/api/alumnos/:id/reactivar', async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query('SELECT * FROM alumnos WHERE id = $1', [id]);
        if (check.rows.length === 0) {
            return res.status(404).json({ error: 'Alumno no encontrado' });
        }
        if (check.rows[0].activo) {
            return res.status(400).json({ error: 'El alumno ya está activo' });
        }
        const resultado = await pool.query(
            'UPDATE alumnos SET activo = true WHERE id = $1 RETURNING id, nombre, apaterno, amaterno, numero_control, activo',
            [id]
        );
        res.json({
            mensaje: `Alumno "${resultado.rows[0].nombre} ${resultado.rows[0].apaterno}" reactivado correctamente`,
            alumno: resultado.rows[0]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 8. PUT - Actualizar alumno
app.put('/api/alumnos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apaterno, amaterno, numero_control, password } = req.body;
    
    let query = 'UPDATE alumnos SET nombre = $1, apaterno = $2, amaterno = $3, numero_control = $4';
    let params = [nombre, apaterno, amaterno, numero_control];
    
    if (password) {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      query += ', password = $5';
      params.push(passwordHash);
      params.push(id);
    } else {
      params.push(id);
    }
    
    query += ' WHERE id = $' + params.length + ' RETURNING id, nombre, apaterno, amaterno, numero_control, activo';
    
    const resultado = await pool.query(query, params);
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    
    res.json({
      mensaje: 'Alumno actualizado con éxito',
      alumno: resultado.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'El número de control ya está registrado' });
    }
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 6007;
app.listen(PORT, () => {
  console.log(`🎓 API Alumnos escuchando en http://localhost:${PORT}`);
});
