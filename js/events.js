/* ============================================
   Events Module (Updated for Backend API)
   ============================================ */

async function createEvent(eventData) {
    if (!eventData.name || !eventData.description || !eventData.category || 
        !eventData.date || !eventData.venue || !eventData.maxCapacity) {
        return { success: false, message: 'All required fields must be filled' };
    }
    if (eventData.maxCapacity < 1) {
        return { success: false, message: 'Event capacity must be at least 1' };
    }
    try {
        const res = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        });
        return await res.json();
    } catch (e) {
        console.error('API Error:', e);
        return { success: false, message: 'Server communication error' };
    }
}

async function deleteEvent(eventId) {
    try {
        const res = await fetch(`/api/events/${eventId}`, {
            method: 'DELETE'
        });
        return await res.json();
    } catch (e) {
        console.error('API Error:', e);
        return { success: false, message: 'Server communication error' };
    }
}

// Alias for template flexibility
const deleteEventFromSystem = deleteEvent;

async function getUpcomingEvents(limit = null) {
    try {
        const events = await getAllEvents();
        const now = new Date();
        const upcoming = events
            .filter(e => new Date(e.date) > now)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        return limit ? upcoming.slice(0, limit) : upcoming;
    } catch (e) {
        console.error('API Error:', e);
        return [];
    }
}

async function getPastEvents() {
    try {
        const events = await getAllEvents();
        const now = new Date();
        return events
            .filter(e => new Date(e.date) <= now)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
        console.error('API Error:', e);
        return [];
    }
}

async function searchEvents(query) {
    try {
        const events = await getAllEvents();
        const lowerQuery = query.toLowerCase();
        return events.filter(e => 
            e.name.toLowerCase().includes(lowerQuery) ||
            e.description.toLowerCase().includes(lowerQuery) ||
            e.venue.toLowerCase().includes(lowerQuery)
        );
    } catch (e) {
        console.error('API Error:', e);
        return [];
    }
}

async function registerForEvent(eventId) {
    const user = getCurrentUser();
    if (!user) return { success: false, message: 'Must be logged in' };
    return await registerUserForEvent(user.id, eventId);
}

async function unregisterFromEvent(eventId) {
    const user = getCurrentUser();
    if (!user) return { success: false, message: 'Must be logged in' };
    return await unregisterUserFromEvent(user.id, eventId);
}
