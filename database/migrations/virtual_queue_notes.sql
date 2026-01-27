-- Virtual Queue Feature - Implementation Notes
-- Date: 2026-01-26
-- Description: Tracks implementation of Phase 3: Virtual Queue System

-- ============================================================================
-- FEATURE: Virtual Queue (15-Minute Pending Window)
-- ============================================================================

-- REQUIREMENTS CHECKLIST:
-- ✅ 1. Patient booking creates appointments with status='pending' (already implemented in booking.tsx)
-- ✅ 2. Pending slots show as amber/yellow in patient booking view
-- ✅ 3. Pending slots are locked (unavailable to other patients)
-- ✅ 4. Doctor can approve/reject pending appointments (UI already exists)
-- ✅ 5. Auto-expiration: Pending appointments older than 15 minutes → 'cancelled'

-- ============================================================================
-- DATABASE REQUIREMENTS:
-- ============================================================================

-- Required columns (already exist):
-- - appointments.status (pending, confirmed, cancelled, completed)
-- - appointments.created_at (timestamp for expiration check)

-- Optional: Add index for performance on expiration queries
CREATE INDEX IF NOT EXISTS idx_appointments_pending_expiration 
ON appointments(status, created_at) 
WHERE status = 'pending';

-- ============================================================================
-- EXPIRATION LOGIC:
-- ============================================================================

-- Auto-expiration runs in two places:
-- 1. DoctorContext.tsx: When doctor refreshes appointments list
-- 2. booking.tsx: When patient views available slots

-- Query used for expiration:
/*
UPDATE appointments 
SET status = 'cancelled' 
WHERE status = 'pending' 
  AND created_at < (NOW() - INTERVAL '15 minutes');
*/

-- ============================================================================
-- USER FLOWS:
-- ============================================================================

-- PATIENT FLOW:
-- 1. Patient browses available slots (green=available, amber=pending, red=booked)
-- 2. Patient selects available slot and books
-- 3. Appointment created with status='pending'
-- 4. Alert shows: "Waiting for doctor confirmation"
-- 5. If doctor doesn't respond within 15 minutes → Auto-cancelled
-- 6. If doctor approves → status='confirmed'
-- 7. If doctor rejects → status='cancelled'

-- DOCTOR FLOW:
-- 1. Doctor sees pending appointments with amber "Pending" badge
-- 2. Three buttons available: Approve | Reschedule | Reject
-- 3. Approve → status='confirmed' (patient notified)
-- 4. Reject → status='cancelled' (slot freed for others)
-- 5. Auto-refresh expires old pending appointments

-- ============================================================================
-- VISUAL INDICATORS:
-- ============================================================================

-- PATIENT BOOKING VIEW (booking.tsx):
-- - Available slots: White background, blue border
-- - Pending slots: Yellow/amber background (#FEF3C7), orange border (#F59E0B)
-- - Booked slots: Gray background, "Booked" label
-- - Blocked slots: Gray background, "N/A" label

-- DOCTOR APPOINTMENTS LIST (appointments.tsx):
-- - Pending badge: Yellow background (#FEF3C7), amber text
-- - Confirmed badge: Green background (#D1FAE5)
-- - Cancelled badge: Red background (#FEE2E2)

-- DOCTOR CALENDAR VIEW (calendar.tsx):
-- - Available slots: White
-- - Pending slots: Amber (#F59E0B)
-- - Confirmed slots: Red (#EF4444)

-- ============================================================================
-- NEXT PHASE: Smart Secretary (Reschedule)
-- ============================================================================

-- Already implemented:
-- ✅ Reschedule modal in appointments.tsx
-- ✅ Date picker with next 14 days
-- ✅ handleReschedule function updates appointment_date

-- TODO for complete Smart Secretary:
-- - Add time slot picker (not just date)
-- - Check slot availability before reschedule
-- - Send push notification to patient
-- - Add SMS notification for walk-in patients

-- ============================================================================
-- TESTING CHECKLIST:
-- ============================================================================

-- [ ] 1. Patient books appointment → status='pending'
-- [ ] 2. Pending slot shows as amber in booking view for other patients
-- [ ] 3. Other patients cannot book pending slots
-- [ ] 4. Doctor sees pending appointment with Approve/Reject buttons
-- [ ] 5. Doctor approves → status='confirmed', slot stays locked
-- [ ] 6. Doctor rejects → status='cancelled', slot becomes available
-- [ ] 7. Wait 16 minutes → pending appointment auto-expires
-- [ ] 8. Expired appointment shows as cancelled
-- [ ] 9. Walk-in registration works (booking_type='walk-in')
-- [ ] 10. Walk-in shows with 🚶 icon and phone number

-- ============================================================================
-- PERFORMANCE NOTES:
-- ============================================================================

-- Index created above helps with:
-- - Fast filtering of pending appointments
-- - Quick expiration queries by created_at
-- - Efficient status checks during booking

-- Expected query performance:
-- - Expiration query: <10ms (with index)
-- - Slot availability check: <50ms (with clinic_id + date filters)
-- - Appointment list fetch: <100ms (with doctor_id index)

