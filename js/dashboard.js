/* ============================================
   Dashboard Module (Updated for Backend API)
   ============================================ */

// Get current user's basic stats
async function getUserStats() {
    try {
        const res = await fetch('/api/dashboard/stats');
        const json = await res.json();
        return json.success ? json.data : null;
    } catch (e) {
        console.error('API Error:', e);
        return null;
    }
}

// Get events for current user
async function getUserEvents() {
    const user = getCurrentUser();
    if (!user) return [];
    
    try {
        const allEvents = await getAllEvents();

        if (user.role === 'student') {
            return allEvents.filter(e => e.attendees.includes(user.id));
        }
        if (user.role === 'organizer') {
            return allEvents.filter(e => e.organizerId === user.id);
        }
        if (user.role === 'admin') {
            return allEvents;
        }
    } catch (e) {
        console.error('API Error:', e);
    }
    return [];
}
