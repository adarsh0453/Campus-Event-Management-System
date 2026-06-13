/* ============================================
   Storage Module - Server API Layer (Updated)
   ============================================ */

function initializeStorage() {
    // No-op on client side as database handles defaults.
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStorage);
} else {
    initializeStorage();
}

// ============ Storage Helpers (Maintained for session & dark mode caching) ============
function setToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('Storage error:', e);
        return false;
    }
}

function getFromStorage(key) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        console.error('Storage error:', e);
        return null;
    }
}

function removeFromStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error('Storage error:', e);
        return false;
    }
}

// ============ User Management (API Backed) ============

async function getAllUsers() {
    try {
        const res = await fetch('/api/users');
        const json = await res.json();
        return json.success ? json.data : [];
    } catch (e) {
        console.error('API error:', e);
        return [];
    }
}

// ============ Event Management (API Backed) ============

async function getAllEvents() {
    try {
        const res = await fetch('/api/events');
        const json = await res.json();
        return json.success ? json.data : [];
    } catch (e) {
        console.error('API error:', e);
        return [];
    }
}

async function getEventById(eventId) {
    try {
        const res = await fetch(`/api/events/${eventId}`);
        const json = await res.json();
        return json.success ? json.data : null;
    } catch (e) {
        console.error('API error:', e);
        return null;
    }
}

// ============ Event Registration (API Backed) ============

async function registerUserForEvent(userId, eventId) {
    try {
        const res = await fetch(`/api/events/${eventId}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
    } catch (e) {
        console.error('API error:', e);
        return { success: false, message: 'Server communication error' };
    }
}

async function unregisterUserFromEvent(userId, eventId) {
    try {
        const res = await fetch(`/api/events/${eventId}/unregister`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        return await res.json();
    } catch (e) {
        console.error('API error:', e);
        return { success: false, message: 'Server communication error' };
    }
}

async function getStudentRegisteredEvents(userId) {
    try {
        const events = await getAllEvents();
        return events.filter(e => e.attendees.includes(userId));
    } catch (e) {
        console.error('API error:', e);
        return [];
    }
}

// ============ Session Management ============

function setCurrentUser(user) {
    const userSession = { id: user.id, name: user.name, email: user.email, role: user.role };
    setToStorage('currentUser', userSession);
}

function getCurrentUser() {
    return getFromStorage('currentUser');
}

function clearCurrentUser() {
    removeFromStorage('currentUser');
}

// ============ Dark Mode ============

function toggleDarkMode(event) {
    event?.preventDefault();
    const isDarkMode = document.body.classList.toggle('dark-mode');
    setToStorage('darkMode', isDarkMode);
    const toggle = document.querySelector('.dark-mode-toggle');
    if (toggle) toggle.textContent = isDarkMode ? '☀️' : '🌙';
}

function loadDarkModePreference() {
    const isDarkMode = getFromStorage('darkMode');
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }
    const toggle = document.querySelector('.dark-mode-toggle');
    if (toggle) toggle.textContent = isDarkMode ? '☀️' : '🌙';
}

loadDarkModePreference();

// ============ Utilities ============

function finishLoading(mainElementId, duration = 1000, callback = null) {
    const loader = document.getElementById('loaderContainer');
    const mainContent = document.getElementById(mainElementId);

    if (loader) {
        loader.style.opacity = '0';
        loader.style.transition = `opacity 0.5s ease`;
        loader.style.pointerEvents = 'none';
    }

    if (mainContent) {
        mainContent.style.display = 'block';
        mainContent.style.opacity = '0';
        mainContent.style.transition = `opacity 0.5s ease`;
        
        setTimeout(() => {
            mainContent.style.opacity = '1';
        }, 50);
    }

    setTimeout(() => {
        if (loader) loader.style.display = 'none';
        if (callback) callback();
    }, duration);
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function capitalizeRole(role) {
    return role.charAt(0).toUpperCase() + role.slice(1);
}
