require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Setup
app.use(session({
    secret: process.env.SESSION_SECRET || 'campus_events_secret_key_123',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));


// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

const connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'campus_events',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
};

// Create global connection pool
const pool = mysql.createPool(connectionConfig);

let useMemoryDb = false;
let isDbInitializing = false;
let isDbInitialized = false;

const memoryDb = {
    users: [],
    events: [],
    registrations: []
};

function initMemoryStore() {
    if (memoryDb.users.length > 0) return;
    const passwordHash = bcrypt.hashSync('password123', 10);
    memoryDb.users = [
        { id: 'user-1', user_name: 'John Student', email: 'student@example.com', password_hash: passwordHash, role: 'student', created_at: new Date() },
        { id: 'user-2', user_name: 'Alice Organizer', email: 'organizer@example.com', password_hash: passwordHash, role: 'organizer', created_at: new Date() },
        { id: 'user-3', user_name: 'Admin User', email: 'admin@example.com', password_hash: passwordHash, role: 'admin', created_at: new Date() },
        { id: 'user-4', user_name: 'Jane Student', email: 'jane@example.com', password_hash: passwordHash, role: 'student', created_at: new Date() },
        { id: 'user-5', user_name: 'Bob Organizer', email: 'bob@example.com', password_hash: passwordHash, role: 'organizer', created_at: new Date() }
    ];

    const futureDate = (daysAhead) => {
        const d = new Date();
        d.setDate(d.getDate() + daysAhead);
        return d.toISOString().split('T')[0];
    };

    memoryDb.events = [
        { id: 'event-1', event_name: 'Web Development Workshop', description: 'Learn modern web development with HTML, CSS, and JavaScript.', category: 'Workshop', event_date: futureDate(7), event_time: '14:00', venue: 'Engineering Building, Room 201', max_capacity: 30, organizer: 'Alice Organizer', organizer_id: 'user-2', event_type: 'In-person', created_at: new Date() },
        { id: 'event-2', event_name: 'Annual Cultural Festival', description: 'Celebrate diversity with music, dance, food, and cultural performances.', category: 'Cultural', event_date: futureDate(14), event_time: '10:00', venue: 'Main Campus Grounds', max_capacity: 500, organizer: 'Alice Organizer', organizer_id: 'user-2', event_type: 'In-person', created_at: new Date() },
        { id: 'event-3', event_name: 'Basketball Tournament', description: 'Compete in our inter-class basketball tournament. All skill levels welcome.', category: 'Sports', event_date: futureDate(21), event_time: '16:00', venue: 'Sports Complex', max_capacity: 100, organizer: 'Bob Organizer', organizer_id: 'user-5', event_type: 'In-person', created_at: new Date() },
        { id: 'event-4', event_name: 'Data Science Seminar', description: 'Exploring the latest trends in data science and machine learning.', category: 'Academic', event_date: futureDate(10), event_time: '13:00', venue: 'Virtual Meeting Room', max_capacity: 150, organizer: 'Alice Organizer', organizer_id: 'user-2', event_type: 'Online', created_at: new Date() },
        { id: 'event-5', event_name: 'Student Networking Dinner', description: 'Connect with fellow students over dinner.', category: 'Social', event_date: futureDate(5), event_time: '18:00', venue: 'Student Center, Main Hall', max_capacity: 80, organizer: 'Bob Organizer', organizer_id: 'user-5', event_type: 'In-person', created_at: new Date() },
        { id: 'event-6', event_name: 'UI/UX Design Masterclass', description: 'Master the principles of user interface and user experience design.', category: 'Workshop', event_date: futureDate(28), event_time: '15:00', venue: 'Design Lab, Building A', max_capacity: 25, organizer: 'Alice Organizer', organizer_id: 'user-2', event_type: 'Hybrid', created_at: new Date() }
    ];

    memoryDb.registrations = [
        { event_id: 'event-1', user_id: 'user-1' },
        { event_id: 'event-1', user_id: 'user-4' },
        { event_id: 'event-2', user_id: 'user-1' },
        { event_id: 'event-3', user_id: 'user-4' },
        { event_id: 'event-4', user_id: 'user-1' },
        { event_id: 'event-4', user_id: 'user-4' },
        { event_id: 'event-5', user_id: 'user-1' }
    ];
}

function runMemoryQuery(sql, params = []) {
    initMemoryStore();
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    if (/SHOW TABLES LIKE 'users'/i.test(cleanSql)) {
        return [{ Tables_in_db: 'users' }];
    }
    if (/SELECT id FROM users WHERE email = \?/i.test(cleanSql)) {
        return memoryDb.users.filter(u => u.email === params[0]).map(u => ({ id: u.id }));
    }
    if (/SELECT \* FROM users WHERE email = \?/i.test(cleanSql)) {
        return memoryDb.users.filter(u => u.email === params[0]);
    }
    if (/INSERT INTO users/i.test(cleanSql)) {
        memoryDb.users.push({
            id: params[0],
            user_name: params[1],
            email: params[2],
            password_hash: params[3],
            role: params[4],
            created_at: new Date()
        });
        return { affectedRows: 1 };
    }
    if (/FROM users u/i.test(cleanSql)) {
        return memoryDb.users.map(u => ({
            id: u.id,
            name: u.user_name,
            email: u.email,
            role: u.role,
            created_at: u.created_at,
            registration_count: memoryDb.registrations.filter(r => r.user_id === u.id).length
        })).sort((a, b) => a.name.localeCompare(b.name));
    }
    if (/GROUP_CONCAT\(r\.user_id\) as attendees/i.test(cleanSql)) {
        let eventsList = memoryDb.events;
        if (cleanSql.includes('WHERE e.id = ?')) {
            eventsList = eventsList.filter(e => e.id === params[0]);
        }
        return eventsList.map(e => {
            const atts = memoryDb.registrations.filter(r => r.event_id === e.id).map(r => r.user_id).join(',');
            return {
                id: e.id,
                event_name: e.event_name,
                description: e.description,
                category: e.category,
                event_date: e.event_date,
                event_time: e.event_time,
                venue: e.venue,
                max_capacity: e.max_capacity,
                organizer: e.organizer,
                organizer_id: e.organizer_id,
                event_type: e.event_type,
                created_at: e.created_at,
                attendees: atts || null
            };
        });
    }
    if (/COUNT\(r\.user_id\) as current_attendees/i.test(cleanSql)) {
        const evs = memoryDb.events.filter(e => e.id === params[0]);
        if (evs.length === 0) return [];
        const ev = evs[0];
        const count = memoryDb.registrations.filter(r => r.event_id === ev.id).length;
        return [{ ...ev, current_attendees: count }];
    }
    if (/INSERT INTO events/i.test(cleanSql)) {
        memoryDb.events.push({
            id: params[0],
            event_name: params[1],
            description: params[2],
            category: params[3],
            event_date: params[4],
            event_time: params[5],
            venue: params[6],
            max_capacity: params[7],
            organizer: params[8],
            organizer_id: params[9],
            event_type: params[10],
            created_at: new Date()
        });
        return { affectedRows: 1 };
    }
    if (/SELECT organizer_id FROM events WHERE id = \?/i.test(cleanSql)) {
        return memoryDb.events.filter(e => e.id === params[0]).map(e => ({ organizer_id: e.organizer_id }));
    }
    if (/DELETE FROM events WHERE id = \?/i.test(cleanSql)) {
        memoryDb.events = memoryDb.events.filter(e => e.id !== params[0]);
        memoryDb.registrations = memoryDb.registrations.filter(r => r.event_id !== params[0]);
        return { affectedRows: 1 };
    }
    if (/SELECT user_id FROM registrations WHERE event_id = \? AND user_id = \?/i.test(cleanSql)) {
        return memoryDb.registrations.filter(r => r.event_id === params[0] && r.user_id === params[1]);
    }
    if (/INSERT INTO registrations/i.test(cleanSql)) {
        memoryDb.registrations.push({ event_id: params[0], user_id: params[1] });
        return { affectedRows: 1 };
    }
    if (/DELETE FROM registrations WHERE event_id = \? AND user_id = \?/i.test(cleanSql)) {
        memoryDb.registrations = memoryDb.registrations.filter(r => !(r.event_id === params[0] && r.user_id === params[1]));
        return { affectedRows: 1 };
    }
    if (/SELECT COUNT\(\*\) as count FROM users/i.test(cleanSql)) {
        return [{ count: memoryDb.users.length }];
    }
    if (/SELECT COUNT\(\*\) as count FROM events WHERE organizer_id = \? AND event_date > \?/i.test(cleanSql)) {
        return [{ count: memoryDb.events.filter(e => e.organizer_id === params[0] && String(e.event_date) > params[1]).length }];
    }
    if (/SELECT COUNT\(\*\) as count FROM events WHERE organizer_id = \?/i.test(cleanSql)) {
        return [{ count: memoryDb.events.filter(e => e.organizer_id === params[0]).length }];
    }
    if (/SELECT COUNT\(\*\) as count FROM events WHERE event_date > \?/i.test(cleanSql)) {
        return [{ count: memoryDb.events.filter(e => String(e.event_date) > params[0]).length }];
    }
    if (/SELECT COUNT\(\*\) as count FROM events/i.test(cleanSql)) {
        return [{ count: memoryDb.events.length }];
    }
    if (/SELECT COUNT\(\*\) as count FROM registrations/i.test(cleanSql)) {
        return [{ count: memoryDb.registrations.length }];
    }
    if (/SELECT COUNT\(r\.user_id\) as count FROM registrations r JOIN events e/i.test(cleanSql)) {
        const count = memoryDb.registrations.filter(r => {
            const ev = memoryDb.events.find(e => e.id === r.event_id);
            return ev && ev.organizer_id === params[0];
        }).length;
        return [{ count }];
    }
    if (/SELECT COUNT\(r\.event_id\) as count FROM registrations r JOIN events e ON r\.event_id = e\.id WHERE r\.user_id = \? AND e\.event_date > \?/i.test(cleanSql)) {
        const count = memoryDb.registrations.filter(r => {
            const ev = memoryDb.events.find(e => e.id === r.event_id);
            return r.user_id === params[0] && ev && String(ev.event_date) > params[1];
        }).length;
        return [{ count }];
    }
    if (/SELECT COUNT\(r\.event_id\) as count FROM registrations r JOIN events e ON r\.event_id = e\.id WHERE r\.user_id = \? AND e\.event_date <= \?/i.test(cleanSql)) {
        const count = memoryDb.registrations.filter(r => {
            const ev = memoryDb.events.find(e => e.id === r.event_id);
            return r.user_id === params[0] && ev && String(ev.event_date) <= params[1];
        }).length;
        return [{ count }];
    }
    if (/SELECT COUNT\(r\.event_id\) as count FROM registrations r JOIN events e ON r\.event_id = e\.id WHERE r\.user_id = \?/i.test(cleanSql)) {
        const count = memoryDb.registrations.filter(r => r.user_id === params[0]).length;
        return [{ count }];
    }

    return [];
}

async function safeQuery(sql, params = []) {
    if (useMemoryDb) {
        return [runMemoryQuery(sql, params)];
    }

    try {
        return await pool.query(sql, params);
    } catch (err) {
        console.log('[Database Notice] MySQL connection unavailable, activating memory store:', err.message);
        useMemoryDb = true;
        return [runMemoryQuery(sql, params)];
    }
}

// Database Connection and Auto-Initialization
async function initDatabase() {
    if (isDbInitialized || isDbInitializing) return;
    isDbInitializing = true;

    initMemoryStore();

    const rootConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    };

    // 1. Connect without database to ensure it exists
    let connection;
    try {
        connection = await mysql.createConnection(rootConfig);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'campus_events'}\`;`);
        console.log(`Database '${process.env.DB_NAME || 'campus_events'}' confirmed/created.`);
    } catch (err) {
        console.log('Database auto-creation check skipped or failed:', err.message);
    } finally {
        if (connection) await connection.end().catch(() => {});
    }

    // 2. Auto-run schema.sql script to initialize tables if needed
    try {
        const [tables] = await safeQuery("SHOW TABLES LIKE 'users';");
        if (!tables || tables.length === 0) {
            console.log('Tables do not exist. Running schema.sql...');
            const initConnection = await mysql.createConnection({
                ...rootConfig,
                database: process.env.DB_NAME || 'campus_events',
                multipleStatements: true
            });
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            await initConnection.query(schemaSql);
            await initConnection.end();
            console.log('Tables initialized successfully.');
            
            await seedDefaultData();
        } else {
            console.log('Database tables already exist. Skipping schema initialization.');
        }
        isDbInitialized = true;
    } catch (err) {
        console.error('Database schema check/initialization notice:', err.message);
        useMemoryDb = true;
        isDbInitialized = true;
    } finally {
        isDbInitializing = false;
    }
}

// Middleware to lazily check/initialize DB schema for API calls
app.use('/api', async (req, res, next) => {
    if (!isDbInitialized) {
        await initDatabase();
    }
    next();
});

// Seed helper
async function seedDefaultData() {
    console.log('Seeding default users and events...');
    try {
        const passwordHash = await bcrypt.hash('password123', 10);

        const defaultUsers = [
            { id: 'user-1', name: 'John Student', email: 'student@example.com', password_hash: passwordHash, role: 'student' },
            { id: 'user-2', name: 'Alice Organizer', email: 'organizer@example.com', password_hash: passwordHash, role: 'organizer' },
            { id: 'user-3', name: 'Admin User', email: 'admin@example.com', password_hash: passwordHash, role: 'admin' },
            { id: 'user-4', name: 'Jane Student', email: 'jane@example.com', password_hash: passwordHash, role: 'student' },
            { id: 'user-5', name: 'Bob Organizer', email: 'bob@example.com', password_hash: passwordHash, role: 'organizer' }
        ];

        for (const user of defaultUsers) {
            await safeQuery(
                'INSERT INTO users (id, user_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
                [user.id, user.name, user.email, user.password_hash, user.role]
            );
        }

        const futureDate = (daysAhead) => {
            const d = new Date();
            d.setDate(d.getDate() + daysAhead);
            return d.toISOString().split('T')[0];
        };

        const defaultEvents = [
            { id: 'event-1', name: 'Web Development Workshop', description: 'Learn modern web development with HTML, CSS, and JavaScript.', category: 'Workshop', date: futureDate(7), time: '14:00', venue: 'Engineering Building, Room 201', maxCapacity: 30, organizer: 'Alice Organizer', organizerId: 'user-2', type: 'In-person' },
            { id: 'event-2', name: 'Annual Cultural Festival', description: 'Celebrate diversity with music, dance, food, and cultural performances.', category: 'Cultural', date: futureDate(14), time: '10:00', venue: 'Main Campus Grounds', maxCapacity: 500, organizer: 'Alice Organizer', organizerId: 'user-2', type: 'In-person' },
            { id: 'event-3', name: 'Basketball Tournament', description: 'Compete in our inter-class basketball tournament. All skill levels welcome.', category: 'Sports', date: futureDate(21), time: '16:00', venue: 'Sports Complex', maxCapacity: 100, organizer: 'Bob Organizer', organizerId: 'user-5', type: 'In-person' },
            { id: 'event-4', name: 'Data Science Seminar', description: 'Exploring the latest trends in data science and machine learning.', category: 'Academic', date: futureDate(10), time: '13:00', venue: 'Virtual Meeting Room', maxCapacity: 150, organizer: 'Alice Organizer', organizerId: 'user-2', type: 'Online' },
            { id: 'event-5', name: 'Student Networking Dinner', description: 'Connect with fellow students over dinner.', category: 'Social', date: futureDate(5), time: '18:00', venue: 'Student Center, Main Hall', maxCapacity: 80, organizer: 'Bob Organizer', organizerId: 'user-5', type: 'In-person' },
            { id: 'event-6', name: 'UI/UX Design Masterclass', description: 'Master the principles of user interface and user experience design.', category: 'Workshop', date: futureDate(28), time: '15:00', venue: 'Design Lab, Building A', maxCapacity: 25, organizer: 'Alice Organizer', organizerId: 'user-2', type: 'Hybrid' }
        ];

        for (const ev of defaultEvents) {
            await safeQuery(
                'INSERT INTO events (id, event_name, description, category, event_date, event_time, venue, max_capacity, organizer, organizer_id, event_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [ev.id, ev.name, ev.description, ev.category, ev.date, ev.time, ev.venue, ev.maxCapacity, ev.organizer, ev.organizerId, ev.type]
            );
        }

        const registrations = [
            { event_id: 'event-1', user_id: 'user-1' },
            { event_id: 'event-1', user_id: 'user-4' },
            { event_id: 'event-2', user_id: 'user-1' },
            { event_id: 'event-3', user_id: 'user-4' },
            { event_id: 'event-4', user_id: 'user-1' },
            { event_id: 'event-4', user_id: 'user-4' },
            { event_id: 'event-5', user_id: 'user-1' }
        ];

        for (const reg of registrations) {
            await safeQuery(
                'INSERT INTO registrations (event_id, user_id) VALUES (?, ?)',
                [reg.event_id, reg.user_id]
            );
        }

        console.log('Seeding completed successfully.');
    } catch (err) {
        console.error('Error seeding data:', err.message);
    }
}

// ==========================================
// Authentication APIs
// ==========================================

// Register User
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        const [existing] = await safeQuery('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const userId = 'user-' + Date.now();

        await safeQuery(
            'INSERT INTO users (id, user_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
            [userId, name, email, passwordHash, role]
        );

        const newUser = { id: userId, name, email, role };
        req.session.user = newUser;

        res.status(201).json({ success: true, data: newUser });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    try {
        const [users] = await safeQuery('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const userSession = { id: user.id, name: user.user_name, email: user.email, role: user.role };
        req.session.user = userSession;

        res.json({ success: true, data: userSession });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Logout User
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Could not log out' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// Get Current User
app.get('/api/auth/me', (req, res) => {
    if (req.session.user) {
        res.json({ success: true, data: req.session.user });
    } else {
        res.status(401).json({ success: false, message: 'Not logged in' });
    }
});

// ==========================================
// Events APIs
// ==========================================

// Get All Events
app.get('/api/events', async (req, res) => {
    try {
        // Fetch all events along with their attendees comma separated
        const query = `
            SELECT e.*, GROUP_CONCAT(r.user_id) as attendees
            FROM events e
            LEFT JOIN registrations r ON e.id = r.event_id
            GROUP BY e.id
            ORDER BY e.event_date ASC
        `;
        const [rows] = await safeQuery(query);
        
        // Format events array to structure attendees as array of strings
        const events = rows.map(event => {
            const dateStr = new Date(event.event_date).toISOString().split('T')[0];
            return {
                id: event.id,
                name: event.event_name,
                description: event.description,
                category: event.category,
                date: dateStr,
                time: event.event_time,
                venue: event.venue,
                maxCapacity: event.max_capacity,
                organizer: event.organizer,
                organizerId: event.organizer_id,
                type: event.event_type,
                createdAt: event.created_at,
                attendees: event.attendees ? event.attendees.split(',') : []
            };
        });

        res.json({ success: true, data: events });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error fetching events' });
    }
});

// Get Event By ID
app.get('/api/events/:id', async (req, res) => {
    const eventId = req.params.id;
    try {
        const query = `
            SELECT e.*, GROUP_CONCAT(r.user_id) as attendees
            FROM events e
            LEFT JOIN registrations r ON e.id = r.event_id
            WHERE e.id = ?
            GROUP BY e.id
        `;
        const [rows] = await safeQuery(query, [eventId]);
        
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const event = rows[0];
        const dateStr = new Date(event.event_date).toISOString().split('T')[0];
        const formattedEvent = {
            id: event.id,
            name: event.event_name,
            description: event.description,
            category: event.category,
            date: dateStr,
            time: event.event_time,
            venue: event.venue,
            maxCapacity: event.max_capacity,
            organizer: event.organizer,
            organizerId: event.organizer_id,
            type: event.event_type,
            createdAt: event.created_at,
            attendees: event.attendees ? event.attendees.split(',') : []
        };

        res.json({ success: true, data: formattedEvent });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error fetching event details' });
    }
});

// Create Event
app.post('/api/events', async (req, res) => {
    // Check if session exists
    if (!req.session.user || (req.session.user.role !== 'admin' && req.session.user.role !== 'organizer')) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { name, description, category, date, time, venue, maxCapacity, type } = req.body;

    if (!name || !description || !category || !date || !venue || !maxCapacity) {
        return res.status(400).json({ success: false, message: 'All required fields must be filled' });
    }

    if (maxCapacity < 1) {
        return res.status(400).json({ success: false, message: 'Event capacity must be at least 1' });
    }

    try {
        const eventId = 'event-' + Date.now();
        const organizer = req.session.user.name;
        const organizerId = req.session.user.id;

        await safeQuery(
            'INSERT INTO events (id, event_name, description, category, event_date, event_time, venue, max_capacity, organizer, organizer_id, event_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [eventId, name, description, category, date, time || 'TBA', venue, maxCapacity, organizer, organizerId, type || 'In-person']
        );

        const newEvent = {
            id: eventId,
            name,
            description,
            category,
            date,
            time: time || 'TBA',
            venue,
            maxCapacity,
            organizer,
            organizerId,
            type: type || 'In-person',
            attendees: []
        };

        res.status(201).json({ success: true, data: newEvent });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error creating event' });
    }
});

// Delete Event
app.delete('/api/events/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Must be logged in' });
    }

    const eventId = req.params.id;

    try {
        const [events] = await safeQuery('SELECT organizer_id FROM events WHERE id = ?', [eventId]);
        if (events.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const event = events[0];
        if (req.session.user.role === 'organizer' && event.organizer_id !== req.session.user.id) {
            return res.status(403).json({ success: false, message: 'You can only delete your own events' });
        }

        await safeQuery('DELETE FROM events WHERE id = ?', [eventId]);
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error deleting event' });
    }
});

// Register for Event
app.post('/api/events/:id/register', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Must be logged in' });
    }

    const eventId = req.params.id;
    const userId = req.session.user.id;

    try {
        // Fetch event info and current registration counts
        const query = `
            SELECT e.*, COUNT(r.user_id) as current_attendees
            FROM events e
            LEFT JOIN registrations r ON e.id = r.event_id
            WHERE e.id = ?
            GROUP BY e.id
        `;
        const [events] = await safeQuery(query, [eventId]);
        
        if (events.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const event = events[0];

        // Check if already registered
        const [existing] = await safeQuery(
            'SELECT user_id FROM registrations WHERE event_id = ? AND user_id = ?',
            [eventId, userId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Already registered' });
        }

        // Check capacity
        if (event.current_attendees >= event.max_capacity) {
            return res.status(400).json({ success: false, message: 'Event is full' });
        }

        // Insert registration
        await safeQuery(
            'INSERT INTO registrations (event_id, user_id) VALUES (?, ?)',
            [eventId, userId]
        );

        // Fetch updated event
        const [updatedRows] = await safeQuery(`
            SELECT e.*, GROUP_CONCAT(r.user_id) as attendees
            FROM events e
            LEFT JOIN registrations r ON e.id = r.event_id
            WHERE e.id = ?
            GROUP BY e.id
        `, [eventId]);

        const updatedEvent = updatedRows[0];
        const formattedEvent = {
            id: updatedEvent.id,
            name: updatedEvent.event_name,
            description: updatedEvent.description,
            category: updatedEvent.category,
            date: new Date(updatedEvent.event_date).toISOString().split('T')[0],
            time: updatedEvent.event_time,
            venue: updatedEvent.venue,
            maxCapacity: updatedEvent.max_capacity,
            organizer: updatedEvent.organizer,
            organizerId: updatedEvent.organizer_id,
            type: updatedEvent.event_type,
            createdAt: updatedEvent.created_at,
            attendees: updatedEvent.attendees ? updatedEvent.attendees.split(',') : []
        };

        res.json({ success: true, data: formattedEvent });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error registering for event' });
    }
});

// Unregister from Event
app.post('/api/events/:id/unregister', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Must be logged in' });
    }

    const eventId = req.params.id;
    const userId = req.session.user.id;

    try {
        const [existing] = await safeQuery(
            'SELECT user_id FROM registrations WHERE event_id = ? AND user_id = ?',
            [eventId, userId]
        );
        if (existing.length === 0) {
            return res.status(400).json({ success: false, message: 'Not registered' });
        }

        await safeQuery(
            'DELETE FROM registrations WHERE event_id = ? AND user_id = ?',
            [eventId, userId]
        );

        // Fetch updated event
        const [updatedRows] = await safeQuery(`
            SELECT e.*, GROUP_CONCAT(r.user_id) as attendees
            FROM events e
            LEFT JOIN registrations r ON e.id = r.event_id
            WHERE e.id = ?
            GROUP BY e.id
        `, [eventId]);

        const updatedEvent = updatedRows[0];
        const formattedEvent = {
            id: updatedEvent.id,
            name: updatedEvent.event_name,
            description: updatedEvent.description,
            category: updatedEvent.category,
            date: new Date(updatedEvent.event_date).toISOString().split('T')[0],
            time: updatedEvent.event_time,
            venue: updatedEvent.venue,
            maxCapacity: updatedEvent.max_capacity,
            organizer: updatedEvent.organizer,
            organizerId: updatedEvent.organizer_id,
            type: updatedEvent.event_type,
            createdAt: updatedEvent.created_at,
            attendees: updatedEvent.attendees ? updatedEvent.attendees.split(',') : []
        };

        res.json({ success: true, data: formattedEvent });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error unregistering from event' });
    }
});

// ==========================================
// Users Management APIs
// ==========================================

// Get All Users (Admin only)
app.get('/api/users', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    try {
        // Fetch all users with their total registrations count
        const query = `
            SELECT u.id, u.user_name as name, u.email, u.role, u.created_at, COUNT(r.event_id) as registration_count
            FROM users u
            LEFT JOIN registrations r ON u.id = r.user_id
            GROUP BY u.id
            ORDER BY u.user_name ASC
        `;
        const [rows] = await safeQuery(query);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error fetching users' });
    }
});

// ==========================================
// Dashboard Stats APIs
// ==========================================

// Get Dashboard Stats (depending on role)
app.get('/api/dashboard/stats', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Must be logged in' });
    }

    const { id, role } = req.session.user;
    const now = new Date().toISOString().split('T')[0];

    try {
        if (role === 'admin') {
            // Stats for Admin: total users, total events, total registrations, upcoming events
            const [userCount] = await safeQuery('SELECT COUNT(*) as count FROM users');
            const [eventCount] = await safeQuery('SELECT COUNT(*) as count FROM events');
            const [regCount] = await safeQuery('SELECT COUNT(*) as count FROM registrations');
            const [upcomingCount] = await safeQuery('SELECT COUNT(*) as count FROM events WHERE event_date > ?', [now]);

            return res.json({
                success: true,
                data: {
                    totalUsers: userCount[0].count,
                    totalEvents: eventCount[0].count,
                    totalRegistrations: regCount[0].count,
                    upcomingEvents: upcomingCount[0].count
                }
            });
        } 
        
        if (role === 'organizer') {
            // Stats for Organizer: created events count, upcoming events, total attendees
            const [createdCount] = await safeQuery('SELECT COUNT(*) as count FROM events WHERE organizer_id = ?', [id]);
            const [upcomingCount] = await safeQuery('SELECT COUNT(*) as count FROM events WHERE organizer_id = ? AND event_date > ?', [id, now]);
            
            // Total attendees across all events created by this organizer
            const attendeeQuery = `
                SELECT COUNT(r.user_id) as count
                FROM registrations r
                JOIN events e ON r.event_id = e.id
                WHERE e.organizer_id = ?
            `;
            const [attendeeCount] = await safeQuery(attendeeQuery, [id]);

            return res.json({
                success: true,
                data: {
                    created: createdCount[0].count,
                    upcoming: upcomingCount[0].count,
                    totalAttendees: attendeeCount[0].count
                }
            });
        }

        if (role === 'student') {
            // Stats for Student: total registered events, upcoming, past
            const registeredQuery = `
                SELECT COUNT(r.event_id) as count
                FROM registrations r
                JOIN events e ON r.event_id = e.id
                WHERE r.user_id = ?
            `;
            const [registeredCount] = await safeQuery(registeredQuery, [id]);

            const upcomingQuery = `
                SELECT COUNT(r.event_id) as count
                FROM registrations r
                JOIN events e ON r.event_id = e.id
                WHERE r.user_id = ? AND e.event_date > ?
            `;
            const [upcomingCount] = await safeQuery(upcomingQuery, [id, now]);

            const pastQuery = `
                SELECT COUNT(r.event_id) as count
                FROM registrations r
                JOIN events e ON r.event_id = e.id
                WHERE r.user_id = ? AND e.event_date <= ?
            `;
            const [pastCount] = await safeQuery(pastQuery, [id, now]);

            return res.json({
                success: true,
                data: {
                    registered: registeredCount[0].count,
                    upcoming: upcomingCount[0].count,
                    past: pastCount[0].count
                }
            });
        }

        res.status(400).json({ success: false, message: 'Invalid role' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Database error loading stats' });
    }
});

// Wildcard fallback to serve static HTML pages or index.html
app.get('*', (req, res) => {
    // If it's an API route that wasn't matched, return 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: 'API Route Not Found' });
    }
    
    // Serve requested HTML file if it exists, or fallback to index.html
    const requestedFile = req.path === '/' ? 'index.html' : req.path;
    const filePath = path.join(__dirname, requestedFile);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return res.sendFile(filePath);
    }
    
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }
    
    res.status(404).send('Page Not Found');
});

// Handle JSON parse errors gracefully (return JSON, not HTML)
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'Invalid JSON in request body' });
    }
    next(err);
});

// Generic error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
});

// Start server locally or export app for Vercel Serverless
if (require.main === module) {
    initDatabase().then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running at http://localhost:${PORT}`);
        });
    }).catch(err => {
        console.error('Failed to initialize database before starting server:', err.message);
    });
}

module.exports = app;
