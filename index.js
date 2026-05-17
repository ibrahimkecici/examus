require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const importRoutes = require('./src/routes/importRoutes');
const planningRoutes = require('./src/routes/planningRoutes');
const aiRoutes = require('./src/routes/aiRoutes');
const reportRoutes = require('./src/routes/reportRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes');
const manualEditRoutes = require('./src/routes/manualEditRoutes');
const { requireAuth } = require('./src/middleware/auth');
const {
  classroomRoutes,
  courseRoutes,
  departmentRoutes,
  examPeriodRoutes,
  examRoutes,
  invigilatorRoutes,
  studentRoutes,
} = require('./src/routes/resourceRoutes');
const healthRoutes = require('./src/routes/healthRoutes');
const notFound = require('./src/middleware/notFound');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.send('Examus API Sunucusu Çalışıyor...');
});

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/invigilators', invigilatorRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/exam-periods', examPeriodRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api', manualEditRoutes);

// Turkish aliases kept for the existing frontend routes while it is migrated.
app.use('/api/derslikler', classroomRoutes);
app.use('/api/gozetmenler', invigilatorRoutes);
app.use('/api/sinavlar', examRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda başlatıldı. Mod: ${process.env.NODE_ENV || 'development'}`);
});
