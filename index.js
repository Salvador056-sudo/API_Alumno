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
app.post('/api/alumnos/registro', async (req, res) => {
  try {
    const { nombre, apaterno, amaterno, numero_control, password } = req.body;
    
    // Validaciones
    if (!nombre || !apaterno || !amaterno || !numero_control || !password) {
      return res.status(400).json({ 
        error: 'Todos los campos son requeridos: nombre, apaterno, amaterno, numero_control, password' 
      });
    }
    
    // Hashear contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    const nuevo = await pool.query(
      `INSERT INTO alumnos (nombre, apaterno, amaterno, numero_control, password) 
       VALUES ($1, $2, $3, $4, $5) 
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

// 3. GET - Obtener un alumno por ID
app.get('/api/alumnos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      `SELECT id, nombre, apaterno, amaterno, numero_control 
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

// 4. GET - Obtener todos los alumnos (solo para admin)
app.get('/api/alumnos', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, nombre, apaterno, amaterno, numero_control FROM alumnos ORDER BY nombre'
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DELETE - Eliminar un alumno
app.delete('/api/alumnos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resultado = await pool.query(
      'DELETE FROM alumnos WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Alumno no encontrado' });
    }
    
    res.json({ mensaje: 'Alumno eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. PUT - Actualizar alumno
app.put('/api/alumnos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apaterno, amaterno, numero_control, password } = req.body;
    
    let query = 'UPDATE alumnos SET nombre = $1, apaterno = $2, amaterno = $3, numero_control = $4';
    let params = [nombre, apaterno, amaterno, numero_control];
    
    // Si se envía contraseña, se actualiza
    if (password) {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      query += ', password = $5';
      params.push(passwordHash);
      params.push(id);
    } else {
      params.push(id);
    }
    
    query += ' WHERE id = $' + params.length + ' RETURNING id, nombre, apaterno, amaterno, numero_control';
    
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

// LISTEN
const PORT = process.env.PORT || 6007;
app.listen(PORT, () => {
  console.log(` API Alumnos escuchando en http://localhost:${PORT}`);
});
