/**
 * Testing Configuration
 * 
 * Fill in your actual IDs from the database before running tests.
 * Run `npm run test:ids` to get these values easily.
 */

module.exports = {
  // Your Supabase configuration (from lib/supabase.ts)
  supabaseUrl: 'https://awqywawapwkpfpcxlbcl.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3cXl3YXdhcHdrcGZwY3hsYmNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc3MzQxMTMsImV4cCI6MjA1MzMxMDExM30.j-kgGJ0Ln9W3JqGdMW7vO_m7UhP7p0nYRd_b1L5s4To',

  // Test IDs - UPDATE THESE WITH YOUR ACTUAL VALUES
  testData: {
    // Doctor ID (from doctors table)
    doctorId: 'YOUR_DOCTOR_ID_HERE',
    
    // Clinic ID (from clinics table)
    clinicId: 'YOUR_CLINIC_ID_HERE',
    
    // Patient/User ID (from profiles table)
    patientId: 'YOUR_PATIENT_ID_HERE',
    
    // Additional test patient IDs for concurrent tests
    additionalPatientIds: [
      'PATIENT_ID_2',
      'PATIENT_ID_3',
      'PATIENT_ID_4',
    ],
  },

  // Test configuration
  testConfig: {
    // Number of appointments to create in heavy load test
    heavyLoadCount: 50,
    
    // Number of concurrent booking attempts to simulate
    concurrentBookingCount: 5,
    
    // Delay between operations (milliseconds)
    operationDelay: 100,
    
    // Test appointment date (defaults to today + 1)
    testDateOffset: 1, // days from today
    
    // Test time slot
    testTimeSlot: '10:00',
  },

  // Cleanup options
  cleanup: {
    // Whether to auto-cleanup test data after tests
    autoCleanup: false,
    
    // Test appointment identifier (status will be set to 'test')
    testStatus: 'test',
  },
};
