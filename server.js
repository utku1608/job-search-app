// Mevcut routes'lardan sonra ekle:
const healthRoutes = require('./routes/healthRoutes');

// Routes'larda ekle:
app.use('/api', healthRoutes);