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

let pool;

// Database Connection and Auto-Initialization
async function initDatabase() {
    const connectionConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    };

    // 1. Connect without database to ensure it exists
    let connection;
    try {
        connection = await mysql.createConnection(connectionConfig);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'campus_events'}\`;`);
        console.log(`Database '${process.env.DB_NAME || 'campus_events'}' confirmed/created.`);
    } catch (err) {
        console.error('Error connecting to MySQL or creating database:', err.message);
        console.error('Make sure MySQL is running and your .env credentials are correct.');
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }

    // 2. Setup the connection pool with the database selected
    pool = mysql.createPool({
        ...connectionConfig,
        database: process.env.DB_NAME || 'campus_events',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    // 3. Auto-run schema.sql script to initialize tables
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        // Split SQL script by semicolons, but ignore semicolons inside comments or strings
        const queries = schemaSql
            .split(/;\s*$/m)
            .map(q => q.trim())
            .filter(q => q.length > 0 && !q.startsWith('--'));

        // Let's check if the tables already exist first before running the schema
        const [tables] = await pool.query("SHOW TABLES LIKE 'users';");
        if (tables.length === 0) {
            console.log('Tables do not exist. Running schema.sql...');
            // Enable multiple statements just for table initialization
            const initConnection = await mysql.createConnection({
                ...connectionConfig,
                database: process.env.DB_NAME || 'campus_events',
                multipleStatements: true
            });
            await initConnection.query(schemaSql);
            await initConnection.end();
            console.log('Tables initialized successfully.');
            
            // Seed default data
            await seedDefaultData();
        } else {
            console.log('Database tables already exist. Skipping schema initialization.');
        }
    } catch (err) {
        console.error('Failed to run schema.sql table initialization:', err.message);
    }
}

// Seed helper
async function seedDefaultData() {
    console.log('Seeding default users and events...');
    try {
        // Hashed password for 'password123'
        const passwordHash = await bcrypt.hash('password123', 10);

        const defaultUsers = [
            { id: 'user-1', name: 'John Student', email: 'student@example.com', password_hash: passwordHash, role: 'student' },
            { id: 'user-2', name: 'Alice Organizer', email: 'organizer@example.com', password_hash: passwordHash, role: 'organizer' },
            { id: 'user-3', name: 'Admin User', email: 'admin@example.com', password_hash: passwordHash, role: 'admin' },
            { id: 'user-4', name: 'Jane Student', email: 'jane@example.com', password_hash: passwordHash, role: 'student' },
            { id: 'user-5', name: 'Bob Organizer', email: 'bob@example.com', password_hash: passwordHash, role: 'organizer' }
        ];

        // Seed users
        for (const user of defaultUsers) {
            await pool.query(
                'INSERT INTO users (id, user_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
                [user.id, user.name, user.email, user.password_hash, user.role]
            );
        }

        // Helper to generate ISO dates for future
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

        // Seed events
        for (const ev of defaultEvents) {
            await pool.query(
                'INSERT INTO events (id, event_name, description, category, event_date, event_time, venue, max_capacity, organizer, organizer_id, event_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [ev.id, ev.name, ev.description, ev.category, ev.date, ev.time, ev.venue, ev.maxCapacity, ev.organizer, ev.organizerId, ev.type]
            );
        }

        // Seed registrations
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
            await pool.query(
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
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const userId = 'user-' + Date.now();

        await pool.query(
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
        const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
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
        const [rows] = await pool.query(query);
        
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
        const [rows] = await pool.query(query, [eventId]);
        
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

        await pool.query(
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
        const [events] = await pool.query('SELECT organizer_id FROM events WHERE id = ?', [eventId]);
        if (events.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const event = events[0];
        if (req.session.user.role === 'organizer' && event.organizer_id !== req.session.user.id) {
            return res.status(403).json({ success: false, message: 'You can only delete your own events' });
        }

        await pool.query('DELETE FROM events WHERE id = ?', [eventId]);
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
        const [events] = await pool.query(query, [eventId]);
        
        if (events.length === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const event = events[0];

        // Check if already registered
        const [existing] = await pool.query(
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
        await pool.query(
            'INSERT INTO registrations (event_id, user_id) VALUES (?, ?)',
            [eventId, userId]
        );

        // Fetch updated event
        const [updatedRows] = await pool.query(`
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
        const [existing] = await pool.query(
            'SELECT user_id FROM registrations WHERE event_id = ? AND user_id = ?',
            [eventId, userId]
        );
        if (existing.length === 0) {
            return res.status(400).json({ success: false, message: 'Not registered' });
        }

        await pool.query(
            'DELETE FROM registrations WHERE event_id = ? AND user_id = ?',
            [eventId, userId]
        );

        // Fetch updated event
        const [updatedRows] = await pool.query(`
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
        const [rows] = await pool.query(query);
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
            const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users');
            const [eventCount] = await pool.query('SELECT COUNT(*) as count FROM events');
            const [regCount] = await pool.query('SELECT COUNT(*) as count FROM registrations');
            const [upcomingCount] = await pool.query('SELECT COUNT(*) as count FROM events WHERE event_date > ?', [now]);

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
            const [createdCount] = await pool.query('SELECT COUNT(*) as count FROM events WHERE organizer_id = ?', [id]);
            const [upcomingCount] = await pool.query('SELECT COUNT(*) as count FROM events WHERE organizer_id = ? AND event_date > ?', [id, now]);
            
            // Total attendees across all events created by this organizer
            const attendeeQuery = `
                SELECT COUNT(r.user_id) as count
                FROM registrations r
                JOIN events e ON r.event_id = e.id
                WHERE e.organizer_id = ?
            `;
            const [attendeeCount] = await pool.query(attendeeQuery, [id]);

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
            const [registeredCount] = await pool.query(registeredQuery, [id]);

            const upcomingQuery = `
                SELECT COUNT(r.event_id) as count
                FROM registrations r
                JOIN events e ON r.event_id = e.id
                WHERE r.user_id = ? AND e.event_date > ?
            `;
            const [upcomingCount] = await pool.query(upcomingQuery, [id, now]);

            const pastQuery = `
                SELECT COUNT(r.event_id) as count
                FROM registrations r
                JOIN events e ON r.event_id = e.id
                WHERE r.user_id = ? AND e.event_date <= ?
            `;
            const [pastCount] = await pool.query(pastQuery, [id, now]);

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

// Wildcard fallback to index.html for UI navigation
app.get('*', (req, res, next) => {
    // If it's an API route that wasn't matched, return 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ success: false, message: 'API Route Not Found' });
    }
    // Otherwise serve index.html (or continue to standard static fallback)
    next();
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

// Run server after database init
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database before starting server:', err.message);
});
